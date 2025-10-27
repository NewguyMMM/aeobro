import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email || null;
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { platform, profileUrl } = await req.json();
  if (!platform || !profileUrl) {
    return NextResponse.json({ error: "Missing platform or profileUrl" }, { status: 400 });
  }

  const code = `aeobro-${crypto.randomUUID().slice(0, 8)}`;

  await prisma.bioCode.create({
    data: {
      userId: user.id,
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
