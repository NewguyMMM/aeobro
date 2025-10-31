// app/api/profile/[slug]/export/json/route.ts
// ✅ Updated: 2025-10-31 08:36 ET – gated JSON export

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isSyndicationAllowed } from "@/lib/verificationPolicy";

type Params = { params: { slug: string } };
export const revalidate = 3600;

export async function GET(_req: Request, { params }: Params) {
  const slug = params.slug;

  const profile = await prisma.profile.findFirst({
    where: { OR: [{ slug }, { id: slug }] },
    include: {
      user: { select: { plan: true, planStatus: true } },
      serviceItems: {
        where: { isPublic: true },
        orderBy: { position: "asc" },
        select: {
          name: true, description: true, url: true,
          priceMin: true, priceMax: true, priceUnit: true, currency: true,
        },
      },
      faqItems: {
        where: { isPublic: true },
        orderBy: { position: "asc" },
        select: { question: true, answer: true },
      },
      platformAccounts: {
        where: { status: "VERIFIED" },
        select: { provider: true, url: true, handle: true, externalId: true },
      },
    },
  });

  if (!profile) {
    return NextResponse.json(
      { error: "Profile not found" },
      { status: 404, headers: { "X-Robots-Tag": "noindex" } }
    );
  }

  // 🔒 Gate public export
  const allowed = isSyndicationAllowed(profile, { enforcePlan: true });
  if (!allowed) {
    return NextResponse.json(
      {
        error:
          "Syndication disabled. Verify your domain or connect a platform (or activate an eligible plan).",
        verificationStatus: profile.verificationStatus,
      },
      {
        status: 403,
        headers: {
          "X-Robots-Tag": "noindex, nofollow",
          "Cache-Control": "public, s-maxage=300, max-age=120",
        },
      }
    );
  }

  const payload = {
    id: profile.id,
    slug: profile.slug,
    name: profile.displayName ?? profile.legalName ?? profile.slug,
    verificationStatus: profile.verificationStatus,
    website: profile.website ?? null,
    location: profile.location ?? null,
    services: profile.serviceItems,
    faqs: profile.faqItems,
    verifiedPlatforms: profile.platformAccounts,
    updatedAt: profile.updatedAt,
  };

  return NextResponse.json(payload, {
    status: 200,
    headers: {
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=604800",
    },
  });
}
