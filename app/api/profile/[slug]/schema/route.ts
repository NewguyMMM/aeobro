// app/api/profile/[slug]/schema/route.ts
// 📅 Updated: 2026-02-18 02:23 PM ET
// Adds: AI_AGENT schema support end-to-end (SoftwareApplication JSON-LD emitted by lib/schema.ts)
// Keeps: 2-tier publish gating (LITE vs PLUS) + planStatus enforcement (inactive/missing => LITE)
// Keeps: visibility guard so UNPUBLISHED/DELETED profiles return 404 (no longer crawlable)
// Keeps: syndication gating via isSyndicationAllowed
// Keeps: caching + headers behavior
// Result: LITE/inactive cannot publish updateMessage, FAQ, Services (even if stored)

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
 * - planStatus !== "active" => treat as LITE (deny plus publishing)
 * - planStatus missing => treat as LITE (fail closed)
 * - PLUS active => allow
 * - PRO/BUSINESS/ENTERPRISE active => behave like PLUS for now (PRO hidden)
 */
function isPlusPublishingAllowed(planRaw: unknown, planStatusRaw: unknown): boolean {
  const planStatus = String(planStatusRaw ?? "").toLowerCase();
  if (planStatus !== "active") return false;

  const plan = String(planRaw ?? "LITE").toUpperCase();
  const normalized = plan === "FREE" ? "LITE" : plan;

  return (
    normalized === "PLUS" ||
    normalized === "PRO" ||
    normalized === "BUSINESS" ||
    normalized === "ENTERPRISE"
  );
}

/**
 * Ensure AI agent fields are present on the object passed to buildProfileSchema.
 * This is a no-op if fields don't exist; it simply copies them if present.
 * (No Prisma changes, no extra DB calls.)
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

  // Accept slug or internal id; include only what's needed
  const profile = await prisma.profile.findFirst({
    where: {
      OR: [{ slug }, { id: slug }],
    },
    include: {
      user: { select: { plan: true, planStatus: true } },
    },
  });

  // 1) Missing profile => 404
  if (!profile) {
    return notFoundJson("Profile not found");
  }

  // 2) Visibility guard (airtight with /p/[slug] behavior)
  const visibility = (profile as any).visibility as
    | "PUBLIC"
    | "UNPUBLISHED"
    | "DELETED"
    | undefined;

  if (visibility && visibility !== "PUBLIC") {
    return notFoundJson("Profile not found");
  }

  const baseUrl = getBaseUrl();
  const humanUrl = `${baseUrl}/p/${encodeURIComponent(profile.slug ?? slug)}`;

  /** Normalize plan (existing behavior for syndication gate) */
  const plan = (profile as any).plan ?? profile.user?.plan ?? null;

  const verificationStatus =
    (profile.verificationStatus as
      | "UNVERIFIED"
      | "PLATFORM_VERIFIED"
      | "DOMAIN_VERIFIED"
      | null) ?? "UNVERIFIED";

  /** Existing syndication gate */
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
  const plusPublishingAllowed = isPlusPublishingAllowed(
    profile.user?.plan,
    profile.user?.planStatus
  );

  try {
    // Only include updateMessage for PLUS+ active
    const updateMessageForSchema = plusPublishingAllowed
      ? ((profile as any).updateMessage ?? null)
      : null;

    // Ensure AI agent fields are passed through if present on profile
    const profileForSchema = attachAIAgentFieldsIfPresent(profile as any);

    const profileSchema = buildProfileSchema(
      profileForSchema,
      baseUrl,
      updateMessageForSchema
    );

    /** Return profile-only schema */
    if (!wantAll) {
      const body = pretty
        ? JSON.stringify(profileSchema, null, 2)
        : escapeForJsonLd(profileSchema);

      return new NextResponse(body, {
        status: 200,
        headers: {
          "Content-Type": "application/ld+json; charset=utf-8",
          ...(download
            ? {
                "Content-Disposition": `attachment; filename="${slug}-schema.json"`,
              }
            : {}),
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
          "X-Robots-Tag": "all",
          Link: `<${humanUrl}>; rel="describes alternate"; type="text/html"`,
        },
      });
    }

    // ✅ all=1 extras: Only PLUS+ active can publish Services + FAQ
    if (!plusPublishingAllowed) {
      const payload = [profileSchema];
      const body = pretty
        ? JSON.stringify(payload, null, 2)
        : escapeForJsonLd(payload);

      return new NextResponse(body, {
        status: 200,
        headers: {
          "Content-Type": "application/ld+json; charset=utf-8",
          ...(download
            ? {
                "Content-Disposition": `attachment; filename="${slug}-schema-all.json"`,
              }
            : {}),
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
          "X-Robots-Tag": "all",
          Link: `<${humanUrl}>; rel="describes alternate"; type="text/html"`,
        },
      });
    }

    // PLUS+ active: include Services + FAQ
    const [services, faqs] = await Promise.all([
      prisma.serviceItem.findMany({
        where: { profileId: profile.id, isPublic: true },
        orderBy: { position: "asc" },
        select: {
          name: true,
          description: true,
          url: true,
          priceMin: true,
          priceMax: true,
          priceUnit: true,
          currency: true,
        },
      }),
      prisma.fAQItem.findMany({
        where: { profileId: profile.id, isPublic: true },
        orderBy: { position: "asc" },
        select: { question: true, answer: true },
      }),
    ]);

    const servicesJsonLd = buildServiceJsonLd(
      `${humanUrl}#profile`,
      services.map((s) => ({
        name: s.name,
        description: s.description ?? undefined,
        url: s.url ?? undefined,
        priceMin: s.priceMin as any,
        priceMax: s.priceMax as any,
        priceUnit: s.priceUnit ?? undefined,
        currency: s.currency ?? undefined,
      }))
    );

    const faqJsonLd = buildFAQJsonLd(
      profile.slug ?? slug,
      faqs.map((f) => ({
        question: f.question,
        answer: f.answer,
      }))
    );

    const payload = [profileSchema, ...servicesJsonLd, faqJsonLd];

    const body = pretty
      ? JSON.stringify(payload, null, 2)
      : escapeForJsonLd(payload);

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/ld+json; charset=utf-8",
        ...(download
          ? {
              "Content-Disposition": `attachment; filename="${slug}-schema-all.json"`,
            }
          : {}),
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        "X-Robots-Tag": "all",
        Link: `<${humanUrl}>; rel="describes alternate"; type="text/html"`,
      },
    });
  } catch (err: any) {
    console.error("[schema endpoint] build error", {
      slug,
      name: err?.name,
      message: err?.message,
    });
    return NextResponse.json(
      { error: "Failed to build JSON-LD" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
