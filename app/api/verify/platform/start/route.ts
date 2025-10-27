import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import crypto from "crypto";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { platform, profileUrl } = await req.json();
  if (!platform || !profileUrl) {
    return NextResponse.json({ error: "Missing platform or profileUrl" }, { status: 400 });
  }

  const code = `aeobro-${crypto.randomUUID().slice(0, 8)}`;

  // Invalidate/replace any pending code for this platform
  await prisma.bioCode.create({
    data: {
      userId: session.user.id,
      platform,
      profileUrl,
      code,
      status: "PENDING",
    },
  });

  return NextResponse.json({
    marker: code,
    instructions: `Add “${code}” to your public bio at ${profileUrl}, save, then click ‘Check’.`,
  });
}
