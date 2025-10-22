import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const accessToken = (session as any).googleAccessToken as string | undefined;
  if (!accessToken) return NextResponse.json({ ok: false, error: "No Google access token on session" }, { status: 400 });

  const res = await fetch("https://www.googleapis.com/youtube/v3/channels?part=id,snippet&mine=true", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) return NextResponse.json({ ok: false, error: "YouTube API error", details: await res.text() }, { status: 400 });

  const data = await res.json();
  const items = Array.isArray(data?.items) ? data.items : [];
  if (!items.length) return NextResponse.json({ ok: false, error: "No YouTube channel found" }, { status: 400 });

  const channelId = items[0]?.id as string;

  const profile = await prisma.profile.findFirst({
    where: { user: { email: session.user.email } },
    select: { id: true, verifiedPlatforms: true },
  });
  if (!profile) return NextResponse.json({ ok: false, error: "Profile not found" }, { status: 404 });

  const platforms = (profile.verifiedPlatforms as Record<string, unknown>) || {};
  platforms.google = { channelId, connectedAt: new Date().toISOString() };

  await prisma.profile.update({
    where: { id: profile.id },
    data: {
      verificationStatus: "PLATFORM_VERIFIED",
      platformVerifiedAt: new Date(),
      verifiedPlatforms: platforms,
    },
  });

  return NextResponse.json({ ok: true, status: "PLATFORM_VERIFIED", channelId });
}
