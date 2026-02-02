// app/api/health/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const headers = {
    "Cache-Control": "no-store",
  };

  const env = process.env.VERCEL_ENV ?? "unknown";
  const ts = new Date().toISOString();

  // Optional DB check (off by default)
  if (process.env.HEALTH_DB === "1") {
    try {
      const { PrismaClient } = await import("@prisma/client");
      const prisma = new PrismaClient();

      // Simple, deterministic ping
      await prisma.$queryRaw`SELECT 1`;

      await prisma.$disconnect();

      return NextResponse.json(
        { ok: true, ts, env, db: "ok" },
        { status: 200, headers }
      );
    } catch {
      // Health endpoint should clearly signal DB failure without leaking details
      return NextResponse.json(
        { ok: false, ts, env, db: "fail" },
        { status: 503, headers }
      );
    }
  }

  return NextResponse.json(
    { ok: true, ts, env, db: "skipped" },
    { status: 200, headers }
  );
}
