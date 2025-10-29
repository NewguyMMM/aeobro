// app/api/profile/[slug]/schema/route.ts
// Updated: 2025-10-29 09:56 ET – add X-Robots-Tag, HTTP Link header back to human page, keep strong caching

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  buildProfileSchema,
  buildFAQJsonLd,
  buildServiceJsonLd,
} from "@/lib/schema";
import { getBaseUrl } from "@/lib/getBaseUrl";

type Params = { params: { slug: string } };

/**
 * ISR for JSON-LD: cache for 1 hour at the edge, background refresh when stale.
 * Pair this with revalidatePath(`/api/profile/${slug}/schema`) after saves.
 */
export const revalidate = 3600;

/** Escape `<` so `</script>` can’t prematurely close tags if embedded somewhere */
function escapeForJsonLd(obj: unknown) {
  return JSON.stringify(obj).replace(/</g, "\\u003c");
}

export async function GET(req: Request, { params }: Params) {
  const { slug } = params;

  // Query controls
  const url = new URL(req.url);
  const wantAll = url.searchParams.get("all") === "1";
  const pretty = url.searchParams.get("pretty") === "1";
  const download = url.searchParams.get("download") === "1";

  // Accept either canonical slug or internal id as the URL segment
  const profile = await prisma.profile.findFirst({
    where: { OR: [{ slug }, { id: slug }] },
  });

  if (!profile) {
    // Short-cached 404 to avoid hammering DB when crawlers probe bad slugs
    return NextResponse.json(
      { error: "Profile not found" },
      {
        status: 404,
        headers: {
          "Cache-Control": "public, s-maxage=60, max-age=30",
          "Content-Type": "application/json; charset=utf-8",
          "X-Robots-Tag": "noindex",
        },
      }
    );
  }

  const baseUrl = getBaseUrl();
  const humanUrl = `${baseUrl}/p/${encodeURIComponent(profile.slug ?? slug)}`;

  try {
    // Always include the main Profile JSON-LD (gating happens inside buildProfileSchema)
    const profileSchema = buildProfileSchema(profile, baseUrl);

    // If only profile requested
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
          // Edge/CDN caching with generous SWR; HTML page revalidates separately
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=604800",
          // ✅ Signal that this is indexable and points to the human-readable page
          "X-Robots-Tag": "all",
          // ✅ Machine-readable association back to the human page
          // rel="describes" is well-understood; include "alternate" + type hint
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

    // Return an array so validators/tools can handle each block:
    // [ ProfileObject, ServiceObject..., FAQObject ]
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
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=604800",
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
    return NextResponse.json(
      { error: "Failed to build JSON-LD" },
      { status: 500 }
    );
  }
}
