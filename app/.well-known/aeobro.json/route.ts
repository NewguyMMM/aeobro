// app/.well-known/aeobro.json/route.ts
// ✅ Updated: 2025-10-31 08:36 ET – gated machine-readable feed

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isSyndicationAllowed } from "@/lib/verificationPolicy";

/**
 * Optional design:
 * - If you want ONE global feed, you can include the current user's profile or
 *   a curated set. Here we show the simplest form: require a query ?slug=...
 *   to emit a single profile's well-known card.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug") || ""; // e.g., /./aeobro.json?slug=manny
  if (!slug) {
    return NextResponse.json(
      { error: "Missing slug param" },
      { status: 400, headers: { "X-Robots-Tag": "noindex, nofollow" } }
    );
  }

  const profile = await prisma.profile.findFirst({
    where: { OR: [{ slug }, { id: slug }] },
    include: { user: { select: { plan: true, planStatus: true } } },
  });

  if (!profile) {
    return NextResponse.json(
      { error: "Profile not found" },
      { status: 404, headers: { "X-Robots-Tag": "noindex" } }
    );
  }

  // 🔒 Gate public emission
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

  // Minimal example payload (extend as you like)
  const payload = {
    version: 1,
    profile: {
      id: profile.id,
      slug: profile.slug,
      name: profile.displayName ?? profile.legalName ?? profile.slug,
      verificationStatus: profile.verificationStatus,
    },
  };

  return NextResponse.json(payload, {
    status: 200,
    headers: {
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=604800",
    },
  });
}
