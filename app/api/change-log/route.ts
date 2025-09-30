// app/api/change-log/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const profileId = searchParams.get("profileId");
  const limit = Number(searchParams.get("limit") ?? 100);

  const profile = await prisma.profile.findFirst({
    where: { id: profileId ?? "", user: { email: session.user.email } },
    select: { id: true },
  });
  if (!profile) return NextResponse.json({ ok: false, message: "Not found" }, { status: 404 });

  const items = await prisma.changeLog.findMany({
    where: { profileId: profile.id },
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, 200),
  });

  return NextResponse.json({ ok: true, items });
}
