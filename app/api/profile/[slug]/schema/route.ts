// app/api/profile/[slug]/schema/route.ts
// ✅ Updated: 2025-11-02 08:49 ET
// Reconciled: allow Lite + PLATFORM_VERIFIED for /schema; never cache errors; short, safe cache on 200s; keep Link + X-Robots-Tag.

import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  buildProfileSchema,
  buildFAQJsonLd,
  buildServiceJsonLd,
} from "@/lib/schema";
import { getBaseUrl } from "@/lib/getBaseUrl";
import { isSyndicationAllowed } from "@/lib/isSyndicationAllowed"; // ← single source of truth

export const dynamic = "force-dynamic"; // prevent ISR/ISR-like stickiness

type Params = { params: { slug: string } };

/** Escape `<` so `</script>` can’t prematurely close tags if embedded somewhere */
function escapeForJsonLd(obj: unknown) {
  return JSON.stringify(obj).replace(/</g, "\\u003c");
}

export async function GET(req: NextRequest, { params }: Params) {
  const { slug } = params;

  // Query controls
  const url = new URL(req.url);
  const wantAll = url.searchParams.get("all") === "1";
  const pretty = url.searchParams.get("pretty") === "1";
  const download = url.searchParams.get("download") === "1";

  // Accept either canonical slug or internal id as the URL segment
  const profile = await prisma.profile.findFirst({
    where: { OR: [{ slug }, { id: slug }] },
    include: {
      // Keep minimal for gating + whatever your schema builders need elsewhere
      user: { select: { plan: true, planStatus: true } },
    },
  });

  if (!profile) {
    // ❌ Never cache errors to avoid "stuck" behavior
    return NextResponse.json(
      { error: "Profile not found" },
      {
        status: 404,
        headers: {
          "Cache-Control": "no-store",
          "Content-Type": "application/json; charset=utf-8",
          "X-Robots-Tag": "noindex",
        },
      }
    );
  }

  const baseUrl = getBaseUrl();
  const humanUrl = `${baseUrl}/p/${encodeURIComponent(profile.slug ?? slug)}`;

  // Normalize plan for gating (adjust if your plan actually lives on Profile)
  const plan =
    (profile as any).plan ??
    (profile.user?.plan ?? null);

  const verificationStatus =
    (profile.verificationStatus as
      | "UNVERIFIED"
      | "PLATFORM_VERIFIED"
      | "DOMAIN_VERIFIED"
      | null) ?? "UNVERIFIED";

  // ✅ Gate for schema export:
  // Allow DOMAIN_VERIFIED always; allow PLATFORM_VERIFIED even on Lite for /schema;
  // paid plans (Plus/Pro/Business/Enterprise) allowed too.
  const gate = isSyndicationAllowed(
    { verificationStatus, plan },
    {
      enforcePlan: true,
      allowPlatformVerified: true, // ← key change for /schema
      feedKind: "schema",
    }
  );

  if (!gate.allowed) {
    // ❌ Never cache errors; include helpful hints without leaking private data
    return NextResponse.json(
      {
        error:
          gate.reason ||
          "Syndication disabled. Verify your domain or connect a platform (or activate an eligible plan).",
        verificationStatus,
        plan,
        require: gate.require,
        gateReason: gate.reason,
      },
      {
        status: 403,
        headers: {
          "Cache-Control": "no-store", // ← critical anti-stick
          "X-Robots-Tag": "noindex, nofollow",
          "Link": `<${humanUrl}>; rel="alternate"; type="text/html"`,
        },
      }
    );
  }

  try {
    // ✅ Build the main Profile JSON-LD
    const profileSchema = buildProfileSchema(profile, baseUrl);

    if (!wantAll) {
      const payload = profileSchema;
      const body = pretty ? JSON.stringify(payload, null, 2) : escapeForJsonLd(payload);

      return new NextResponse(body, {
        status: 200,
        headers: {
          "Content-Type": "application/ld+json; charset=utf-8",
          ...(download
            ? { "Content-Disposition": `attachment; filename="${slug}-schema.json"` }
            : {}),
          // ✅ Short, safe edge TTL (avoid hour-long stickiness)
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
          "X-Robots-Tag": "all",
          "Link": `<${humanUrl}>; rel="describes alternate"; type="text/html"`,
        },
      });
    }

    // If all=1 → append Services + FAQ JSON-LD too
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

    const serviceJsonLd = buildServiceJsonLd(
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
      faqs.map((f) => ({ question: f.question, answer: f.answer }))
    );

    const payload: any[] = [profileSchema, ...serviceJsonLd, faqJsonLd];
    const body = pretty ? JSON.stringify(payload, null, 2) : escapeForJsonLd(payload);

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/ld+json; charset=utf-8",
        ...(download
          ? {
              "Content-Disposition": `attachment; filename="${slug}-schema-all.json"`,
            }
          : {}),
        // ✅ Short, safe edge TTL
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        "X-Robots-Tag": "all",
        "Link": `<${humanUrl}>; rel="describes alternate"; type="text/html"`,
      },
    });
  } catch (err: any) {
    console.error("[schema endpoint] build error", {
      slug,
      name: err?.name,
      message: err?.message,
    });
    // ❌ Never cache errors
    return NextResponse.json(
      { error: "Failed to build JSON-LD" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
