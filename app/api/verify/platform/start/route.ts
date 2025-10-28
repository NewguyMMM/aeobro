// app/api/verify/platform/start/route.ts
// 📅 Updated: 2025-10-27 02:05 PM ET

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateVerificationToken, platformMarker } from "@/lib/verification";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userIdFromSession = session?.user?.id || null;
    const emailFromSession = session?.user?.email || null;

    if (!userIdFromSession && !emailFromSession) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Resolve the user (prefer id; fall back to email for older sessions)
    let user = null as null | { id: string };
    if (userIdFromSession) {
      user = await prisma.user.findUnique({ where: { id: userIdFromSession }, select: { id: true } });
    } else if (emailFromSession) {
      user = await prisma.user.findUnique({ where: { email: emailFromSession }, select: { id: true } });
    }
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse optional platform/profileUrl for backward compatibility with bioCode table
    let platform: string | undefined;
    let profileUrl: string | undefined;
    try {
      const body = await req.json();
      if (body?.platform && typeof body.platform === "string") platform = body.platform;
      if (body?.profileUrl && typeof body.profileUrl === "string") profileUrl = body.profileUrl.trim();
    } catch {
      // empty or invalid JSON body is fine; we can still start a generic platform flow
    }

    // Ensure the user has a profile
    const profile = await prisma.profile.findUnique({ where: { userId: user.id }, select: { id: true } });
    if (!profile?.id) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Generate a fresh token and marker in the new format
    const token = generateVerificationToken(16); // 32 hex chars
    const marker = platformMarker(token);        // "aeobro-verify-<token>"

    // Initialize platform verification state on the Profile
    await prisma.profile.update({
      where: { id: profile.id },
      data: {
        verifyMethod: "PLATFORM",
        verifyToken: token,
        verifyMarker: marker,
        verifyDomain: null,
        verifyCheckedAt: null,
      },
    });

    // Back-compat: if a specific platform/profileUrl was provided, store a PENDING row in bioCode
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

    // Build user instruction (specific if profileUrl provided, else generic)
    const instructions = profileUrl
      ? `Add “${marker}” to your public bio at ${profileUrl}, save, then click ‘Check’.`
      : `Add “${marker}” to the bio/description of ANY connected platform (e.g., YouTube, TikTok, Instagram, X, LinkedIn), make it public, then click ‘Check’.`;

    return NextResponse.json({
      marker,
      instructions,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Server error" }, { status: 500 });
  }
}
