// app/api/verify/bio/request/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { randomToken } from "@/lib/verify";

export async function POST(req: Request) {
  const session = await auth();

  // TS-safe extraction of the id we inject in the NextAuth session callback
  const userId = (session as any)?.user?.id as string | undefined;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { platform, profileUrl } = await req.json();
  if (!platform || !profileUrl) {
    return NextResponse.json(
      { error: "Missing platform/profileUrl" },
      { status: 400 }
    );
  }

  const code = `aeobro:${randomToken(32)}`;
  const bio = await prisma.bioCode.create({
    data: {
      userId,
      platform,
      profileUrl,
      code,
      status: "PENDING",
    },
  });

  return NextResponse.json({
    id: bio.id,
    code: bio.code,
    instructions: `Place this exact code in your ${platform} bio: ${bio.code}`,
  });
}
