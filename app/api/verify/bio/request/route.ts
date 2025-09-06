import { NextResponse } from "next/server";
import { auth } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { randomToken } from "@/lib/verify";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { platform, profileUrl } = await req.json();
  if (!platform || !profileUrl) return NextResponse.json({ error: "Missing platform/profileUrl" }, { status: 400 });

  const code = `aeobro:${randomToken(32)}`;
  const bio = await prisma.bioCode.create({
    data: {
      userId: session.user.id,
      platform,
      profileUrl,
      code,
      status: "PENDING",
    },
  });

  return NextResponse.json({ id: bio.id, code: bio.code, instructions: `Place this exact code in your ${platform} bio: ${bio.code}` });
}
