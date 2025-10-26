// app/api/profile/verify/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Accepts: { level: "PLATFORM_VERIFIED" | "DOMAIN_VERIFIED" | "UNVERIFIED" }
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { level } = await req.json().catch(() => ({}));
    const allowed = ["PLATFORM_VERIFIED", "DOMAIN_VERIFIED", "UNVERIFIED"] as const;
    if (!allowed.includes(level)) {
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
    const data: any = { verificationStatus: level };
    const now = new Date();

    if (level === "PLATFORM_VERIFIED") {
      data.platformVerifiedAt = now;
      // optional: clear domainVerifiedAt if you want them mutually exclusive
    } else if (level === "DOMAIN_VERIFIED") {
      data.domainVerifiedAt = now;
    }

    // (Optional) prevent downgrade unless explicitly requested
    const updated = await prisma.profile.update({
      where: { id: user.profile.id },
      data,
      select: { id: true, slug: true, verificationStatus: true },
    });

    return NextResponse.json({ ok: true, profile: updated });
  } catch (err) {
    console.error("verify route error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
