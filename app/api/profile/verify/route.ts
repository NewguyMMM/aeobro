// app/api/profile/verify/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidateTag } from "next/cache";

export const dynamic = "force-dynamic";

type Level = "PLATFORM_VERIFIED" | "DOMAIN_VERIFIED" | "UNVERIFIED";

// Accepts: { level: "PLATFORM_VERIFIED" | "DOMAIN_VERIFIED" | "UNVERIFIED" }
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({} as { level?: Level }));
    const level = body.level as Level | undefined;

    const allowed: Level[] = ["PLATFORM_VERIFIED", "DOMAIN_VERIFIED", "UNVERIFIED"];
    if (!level || !allowed.includes(level)) {
      return NextResponse.json({ error: "Invalid level" }, { status: 400 });
    }

    // Find the caller's profile
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, profile: { select: { id: true, slug: true } } },
    });

    if (!user?.profile?.id) {
      return NextResponse.json({ error: "No profile found" }, { status: 404 });
    }

    // Update verification status + timestamp fields
    const now = new Date();
    const data: Record<string, any> = { verificationStatus: level };
    if (level === "PLATFORM_VERIFIED") data.platformVerifiedAt = now;
    if (level === "DOMAIN_VERIFIED") data.domainVerifiedAt = now;

    const updated = await prisma.profile.update({
      where: { id: user.profile.id },
      data,
      select: { id: true, slug: true, verificationStatus: true },
    });

    // 🔄 Invalidate cached profile pages that use this tag
    if (updated?.slug) {
      revalidateTag(`profile:${updated.slug}`);
    }

    return NextResponse.json({ ok: true, profile: updated });
  } catch (err) {
    console.error("verify route error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
