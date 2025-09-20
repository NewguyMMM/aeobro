// app/api/profile/[slug]/schema/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildProfileSchema } from "@/lib/schema";
import { getBaseUrl } from "@/lib/getBaseUrl";

type Params = { params: { slug: string } };

/**
 * ISR for JSON-LD: cache for 1 hour at the edge, background refresh when stale.
 * Pair this with revalidatePath(`/api/profile/${slug}/schema`) after saves.
 */
export const revalidate = 3600;

export async function GET(_req: Request, { params }: Params) {
  const { slug } = params;

  const profile = await prisma.profile.findUnique({
    where: { slug },
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
        },
      }
    );
  }

  const schema = buildProfileSchema(profile, getBaseUrl());

  // Compact JSON-LD (bots are fine with minified)
  const body = JSON.stringify(schema);

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/ld+json; charset=utf-8",
      // Edge/CDN caching with generous SWR; HTML page will still be revalidated separately
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=604800",
    },
  });
}
