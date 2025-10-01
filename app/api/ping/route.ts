import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // Simple query to keep Neon alive
    await prisma.profile.findFirst();
    return NextResponse.json({ ok: true, ts: Date.now() });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
