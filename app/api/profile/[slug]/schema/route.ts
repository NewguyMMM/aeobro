// app/api/profile/[slug]/schema/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildProfileSchema } from "@/lib/schema";
import { getBaseUrl } from "@/lib/getBaseUrl";

type Params = { params: { slug: string } };

export const revalidate = 30;

export async function GET(_req: Request, { params }: Params) {
  const { slug } = params;

  const profile = await prisma.profile.findUnique({
    where: { slug },
  });

  if (!profile) {
    return NextResponse.json(
      { error: "Profile not found" },
      { status: 404, headers: { "Cache-Control": "public, max-age=30" } }
    );
  }

  const schema = buildProfileSchema(profile, getBaseUrl());

  // Proper JSON with caching for bots/crawlers
  return new NextResponse(JSON.stringify(schema, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/ld+json; charset=utf-8",
      "Cache-Control": "public, s-maxage=300, max-age=60, stale-while-revalidate=600",
    },
  });
}
