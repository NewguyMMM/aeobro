// app/api/verify/platform/start/route.ts
// 📅 Updated: 2025-10-27 09:57 PM ET

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email || null;
    if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Resolve the user by email (avoid relying on session.user.id typing)
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Optional body — you may call this without any body at all
    let platform: string | undefined;
    let profileUrl: string | undefined;
    try {
      const body = await req.json();
      if (typeof body?.platform === "string") platform = body.platform;
      if (typeof body?.profileUrl === "string") profileUrl = body.profileUrl.trim();
    } catch {
      // empty / invalid JSON is fine
    }

    // Generate a verification marker (new preferred prefix)
    const token = crypto.randomBytes(16).toString("hex"); // 32 hex chars
    const marker = `aeobro-verify-${token}`;

    // If platform + profileUrl were provided, store a pending BioCode row (back-compat path)
    if (platform && profileUrl) {
      await prisma.bioCode.create({
        data: {
          userId: user.id,
          platform,
          profileUrl,
          code: marker,
          status: "PENDING",
        },
      });
    }

    // Return instructions (specific if profileUrl provided, else generic)
    const instructions = profileUrl
      ? `Add “${marker}” to your public bio at ${profileUrl}, save, then click ‘Check’.`
      : `Add “${marker}” to the bio/description of ANY connected platform (YouTube, TikTok, Instagram, X, LinkedIn, etc.), make it public, then click ‘Check’.`;

    return NextResponse.json({
      marker,
      instructions,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Server error" }, { status: 500 });
  }
}
