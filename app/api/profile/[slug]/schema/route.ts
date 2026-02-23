// app/api/profile/[slug]/schema/route.ts
// 📅 Updated: 2026-02-23 08:05 AM ET
// Fixes:
// - Treat planStatus "trialing" as entitled for PLUS publishing (active || trialing)
// - Use profile.servicesJson + profile.faqJson (JSON columns) instead of legacy tables
// - Keep: visibility guard, syndication gating, caching/headers, AI_AGENT schema passthrough

import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildProfileSchema, buildFAQJsonLd, buildServiceJsonLd } from "@/lib/schema";
import { getBaseUrl } from "@/lib/getBaseUrl";
import { isSyndicationAllowed } from "@/lib/isSyndicationAllowed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: { slug: string } };

/** Prevent </script> injection */
function escapeForJsonLd(obj: unknown) {
  return JSON.stringify(obj).replace(/</g, "\\u003c");
}

function notFoundJson(message = "Profile not found") {
  return NextResponse.json(
    { error: message },
    {
      status: 404,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "application/json; charset=utf-8",
        "X-Robots-Tag": "noindex, nofollow, noarchive",
      },
    }
  );
}

/**
 * 2-tier effective publish access:
 * - planStatus not entitled => treat as LITE (deny plus publishing)
 * - planStatus missing => treat as LITE (fail closed)
 * - entitled: active OR trialing
 * - PLUS/PRO/BUSINESS/ENTERPRISE entitled => allow
 */
function isPlusPublishingAllowed(planRaw: unknown, planStatusRaw: unknown): boolean {
  const planStatus = String(planStatusRaw ?? "").toLowerCase();
  const entitled = planStatus === "active" || planStatus === "trialing";
  if (!entitled) return false;

  const plan = String(planRaw ?? "LITE").toUpperCase();
  const normalized = plan === "FREE" ? "LITE" : plan;

  return normalized === "PLUS" || normalized === "PRO" || normalized === "BUSINESS" || normalized === "ENTERPRISE";
}

/**
 * Ensure AI agent fields are present on the object passed to buildProfileSchema.
 * No-op if fields don't exist.
 */
function attachAIAgentFieldsIfPresent(profile: any) {
  const keys = [
    "aiAgentProvider",
    "aiAgentModel",
    "aiAgentVersion",
    "aiAgentDocsUrl",
    "aiAgentApiUrl",
    "aiAgentCapabilities",
    "aiAgentInputModes",
    "aiAgentOutputModes",
  ];

  const out: any = { ...profile };
  for (const k of keys) {
    if (profile && Object.prototype.hasOwnProperty.call(profile, k)) {
      out[k] = (profile as any)[k];
    }
  }
  return out;
}

export async function GET(req: NextRequest, { params }: Params) {
  const { slug } = params;

  const url = new URL(req.url);
  const wantAll = url.searchParams.get("all") === "1";
  const pretty = url.searchParams.get("pretty") === "1";
  const download = url.searchParams.get("download") === "1";

  const profile = await prisma.profile.findFirst({
    where: { OR: [{ slug }, { id: slug }] },
    include: { user: { select: { plan: true, planStatus: true } } },
  });

  if (!profile) return notFoundJson("Profile not found");

  // Visibility guard (matches /p/[slug])
  const visibility = (profile as any).visibility as "PUBLIC" | "UNPUBLISHED" | "DELETED" | undefined;
  if (visibility && visibility !== "PUBLIC") return notFoundJson("Profile not found");

  const baseUrl = getBaseUrl();
  const humanUrl = `${baseUrl}/p/${encodeURIComponent(profile.slug ?? slug)}`;

  // Prefer User plan for gates (profile.plan may be stale/legacy)
  const plan = profile.user?.plan ?? null;

  const verificationStatus =
    (profile.verificationStatus as "UNVERIFIED" | "PLATFORM_VERIFIED" | "DOMAIN_VERIFIED" | null) ?? "UNVERIFIED";

  const gate = isSyndicationAllowed(
    { verificationStatus, plan },
    {
      enforcePlan: true,
      allowPlatformVerified: true,
      feedKind: "schema",
    }
  );

  if (!gate.allowed) {
    return NextResponse.json(
      {
        error:
          gate.reason ??
          "Syndication disabled. Verify your domain or connect a platform (or activate an eligible plan).",
        verificationStatus,
        plan,
        require: gate.require,
        gateReason: gate.reason,
      },
      {
        status: 403,
        headers: {
          "Cache-Control": "no-store",
          "X-Robots-Tag": "noindex, nofollow, noarchive",
          Link: `<${humanUrl}>; rel="alternate"; type="text/html"`,
        },
      }
    );
  }

  // ✅ 2-tier publish gating boundary (fail-closed via planStatus)
  const plusPublishingAllowed = isPlusPublishingAllowed(profile.user?.plan, profile.user?.planStatus);

  try {
    // Only include updateMessage for entitled PLUS-like
    const updateMessageForSchema = plusPublishingAllowed ? ((profile as any).updateMessage ?? null) : null;

    // Pass AI agent fields through if present on profile
    const profileForSchema = attachAIAgentFieldsIfPresent(profile as any);

    const profileSchema = buildProfileSchema(profileForSchema, baseUrl, updateMessageForSchema);

    // profile-only schema
    if (!wantAll) {
      const body = pretty ? JSON.stringify(profileSchema, null, 2) : escapeForJsonLd(profileSchema);

      return new NextResponse(body, {
        status: 200,
        headers: {
          "Content-Type": "application/ld+json; charset=utf-8",
          ...(download ? { "Content-Disposition": `attachment; filename="${slug}-schema.json"` } : {}),
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
          "X-Robots-Tag": "all",
          Link: `<${humanUrl}>; rel="describes alternate"; type="text/html"`,
        },
      });
    }

    // all=1 extras: Only entitled PLUS-like can publish Services + FAQ
    if (!plusPublishingAllowed) {
      const payload = [profileSchema];
      const body = pretty ? JSON.stringify(payload, null, 2) : escapeForJsonLd(payload);

      return new NextResponse(body, {
        status: 200,
        headers: {
          "Content-Type": "application/ld+json; charset=utf-8",
          ...(download ? { "Content-Disposition": `attachment; filename="${slug}-schema-all.json"` } : {}),
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
          "X-Robots-Tag": "all",
          Link: `<${humanUrl}>; rel="describes alternate"; type="text/html"`,
        },
      });
    }

    // ✅ Entitled PLUS-like: include Services + FAQ from JSON columns
    const services = Array.isArray((profile as any).servicesJson) ? ((profile as any).servicesJson as any[]) : [];
    const faqs = Array.isArray((profile as any).faqJson) ? ((profile as any).faqJson as any[]) : [];

    const servicesJsonLd = buildServiceJsonLd(
      `${humanUrl}#profile`,
      services
        .map((s) => ({
          name: s?.name,
          description: s?.description ?? undefined,
          url: s?.url ?? undefined,
          priceMin: s?.priceMin ?? undefined,
          priceMax: s?.priceMax ?? undefined,
          priceUnit: s?.priceUnit ?? undefined,
          currency: s?.currency ?? undefined,
        }))
        .filter((s) => typeof s.name === "string" && s.name.trim().length > 0)
    );

    const faqJsonLd = buildFAQJsonLd(
      profile.slug ?? slug,
      faqs
        .map((f) => ({
          question: f?.question,
          answer: f?.answer,
        }))
        .filter(
          (f) =>
            typeof f.question === "string" &&
            f.question.trim().length > 0 &&
            typeof f.answer === "string" &&
            f.answer.trim().length > 0
        )
    );

    const payload = [profileSchema, ...servicesJsonLd, faqJsonLd];
    const body = pretty ? JSON.stringify(payload, null, 2) : escapeForJsonLd(payload);

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/ld+json; charset=utf-8",
        ...(download ? { "Content-Disposition": `attachment; filename="${slug}-schema-all.json"` } : {}),
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        "X-Robots-Tag": "all",
        Link: `<${humanUrl}>; rel="describes alternate"; type="text/html"`,
      },
    });
  } catch (err: any) {
    console.error("[schema endpoint] build error", { slug, name: err?.name, message: err?.message });
    return NextResponse.json({ error: "Failed to build JSON-LD" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
