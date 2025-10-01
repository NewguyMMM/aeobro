import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  try {
    const one = await prisma.profile.findMany({ take: 1, select: { id: true, slug: true } });
    return NextResponse.json({ ok: true, count: one.length, sample: one[0] ?? null });
  } catch (err: any) {
    // Surface the real cause
    return NextResponse.json(
      { ok: false, name: err?.name, message: err?.message, code: err?.code },
      { status: 500 }
    );
  }
}
