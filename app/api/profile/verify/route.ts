// app/api/profile/verify/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath, revalidateTag } from "next/cache";
import type { $Enums } from "@prisma/client";

export const dynamic = "force-dynamic";

type Level = $Enums.VerificationLevel; // "UNVERIFIED" | "PLATFORM_VERIFIED" | "DOMAIN_VERIFIED"
const ALLOWED: Level[] = ["PLATFORM_VERIFIED", "DOMAIN_VERIFIED", "UNVERIFIED"];

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({} as { level?: Level }));
    const level = body.level as Level | undefined;

    if (!level || !ALLOWED.includes(level)) {
      return NextResponse.json({ error: "Invalid level" }, { status: 400 });
    }

    // Pull minimal user + profile
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, profile: { select: { id: true, slug: true, verificationStatus: true, platformVerifiedAt: true, domainVerifiedAt: true } } },
    });

    if (!user?.profile?.id) {
      return NextResponse.json({ error: "No profile found" }, { status: 404 });
    }

    const { id: profileId, slug, verificationStatus: beforeStatus } = user.profile;
    const now = new Date();

    // Build update payload with proper timestamp hygiene
    const data: Parameters<typeof prisma.profile.update>[0]["data"] = {
      verificationStatus: level,
      // Clear timestamps when un-verifying; stamp only the corresponding one otherwise
      platformVerifiedAt:
        level === "UNVERIFIED" ? null : level === "PLATFORM_VERIFIED" ? now : user.profile.platformVerifiedAt ?? null,
      domainVerifiedAt:
        level === "UNVERIFIED" ? null : level === "DOMAIN_VERIFIED" ? now : user.profile.domainVerifiedAt ?? null,
    };

    const updated = await prisma.$transaction(async (tx) => {
      const profile = await tx.profile.update({
        where: { id: profileId },
        data,
        select: {
          id: true,
          slug: true,
          verificationStatus: true,
          platformVerifiedAt: true,
          domainVerifiedAt: true,
        },
      });

      // Write a change log entry
      await tx.changeLog.create({
        data: {
          userId: user.id,
          profileId: profileId,
          entity: "PROFILE",
          action: "UPDATE",
          field: "verificationStatus",
          before: { verificationStatus: beforeStatus },
          after: { verificationStatus: level },
        },
      });

      return profile;
    });

    // Revalidate cached pages/views
    if (updated?.slug) {
      // Tag-based (for fetch caches using tags)
      revalidateTag(`profile:${updated.slug}`);
      // Path-based (for public profile & dashboard)
      revalidatePath(`/p/${updated.slug}`);
    }
    revalidatePath(`/dashboard`);

    return NextResponse.json({ ok: true, profile: updated });
  } catch (err) {
    console.error("verify route error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
