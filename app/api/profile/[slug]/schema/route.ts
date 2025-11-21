// app/api/profile/[slug]/schema/route.ts
// 📅 Updated: 2025-11-21 — Include updateMessage in JSON-LD without invalid Prisma include.

import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  buildProfileSchema,
  buildFAQJsonLd,
  buildServiceJsonLd,
} from "@/lib/schema";
import { getBaseUrl } from "@/lib/getBaseUrl";
import { isSyndicationAllowed } from "@/lib/isSyndicationAllowed";

export const dynamic = "force-dynamic";

type Params = { params: { slug: string } };

/** Prevent </script> injection */
function escapeForJsonLd(obj: unknown) {
  return JSON.stringify(obj).replace(/</g, "\\u003c");
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
      // ❌ no latestUpdate here – updateMessage is a scalar on Profile
    },
  });

  if (!profile) {
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
  const humanUrl = `${baseUrl}/p/${encodeURIComponent(
    profile.slug ?? slug
  )}`;

  /** Normalize plan */
  const plan =
    (profile as any).plan ??
    profile.user?.plan ??
    null;

  const verificationStatus =
    (profile.verificationStatus as
      | "UNVERIFIED"
      | "PLATFORM_VERIFIED"
      | "DOMAIN_VERIFIED"
      | null) ?? "UNVERIFIED";

  /** Gating — allow PLATFORM_VERIFIED (even Lite) for JSON-LD */
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
          "X-Robots-Tag": "noindex, nofollow",
          Link: `<${humanUrl}>; rel="alternate"; type="text/html"`,
        },
      }
    );
  }

  try {
    // ⭐ Pass updateMessage (the “latest update” text) into the schema builder
    const profileSchema = buildProfileSchema(
      profile,
      baseUrl,
      profile.updateMessage ?? null
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

    // ⭐ all=1 → include Services + FAQ
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
