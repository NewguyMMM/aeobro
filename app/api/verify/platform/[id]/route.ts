// app/api/verify/platform/[id]/route.ts
// ✅ Updated: 2025-12-03 23:44 ET
// Disconnect a platform account, then recompute profile.verificationStatus + verifiedPlatforms.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Deletes (or soft-disconnects) a PlatformAccount owned by the current user,
 * then recalculates the profile's verificationStatus.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id as string | undefined;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const id = params.id;
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    // Ensure the account belongs to this user
    const account = await prisma.platformAccount.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        profileId: true,
        provider: true,
        externalId: true,
      },
    });

    if (!account || account.userId !== userId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const profileId = account.profileId;
    const provider = account.provider;

    // Hard delete the platform account
    await prisma.platformAccount.delete({ where: { id } });

    // If there is no associated profile, we're done
    if (!profileId) {
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    // Load profile to inspect current status + verifiedPlatforms
    const profile = await prisma.profile.findUnique({
      where: { id: profileId },
      select: {
        verificationStatus: true,
        verifiedPlatforms: true,
      },
    });

    if (!profile) {
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    // Count remaining VERIFIED platform accounts for this profile
    const remainingVerified = await prisma.platformAccount.count({
      where: { profileId, status: "VERIFIED" },
    });

    // Rebuild verifiedPlatforms map without this provider
    const verifiedMap = (profile.verifiedPlatforms as any) ?? {};
    if (verifiedMap && typeof verifiedMap === "object") {
      delete verifiedMap[provider];
    }

    let newStatus = profile.verificationStatus;

    if (remainingVerified === 0) {
      // No more verified platform accounts.
      // If the profile was PLATFORM_VERIFIED, drop to UNVERIFIED.
      // If it was DOMAIN_VERIFIED, keep it (DNS verification still stands).
      if (profile.verificationStatus === "PLATFORM_VERIFIED") {
        newStatus = "UNVERIFIED";
      }
    } else {
      // There are still verified platforms attached.
      // If the profile is not DOMAIN_VERIFIED, ensure it is at least PLATFORM_VERIFIED.
      if (profile.verificationStatus !== "DOMAIN_VERIFIED") {
        newStatus = "PLATFORM_VERIFIED";
      }
    }

    // Only update if something actually changed
    await prisma.profile.update({
      where: { id: profileId },
      data: {
        verificationStatus: newStatus,
        verifiedPlatforms: verifiedMap,
      },
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: any) {
    console.error("DELETE /api/verify/platform/[id] error:", err);
    return NextResponse.json(
      { error: "Failed to disconnect" },
      { status: 500 }
    );
  }
}
