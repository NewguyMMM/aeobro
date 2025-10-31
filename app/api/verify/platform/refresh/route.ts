// app/api/verify/platform/refresh/route.ts
// ✅ Updated: 2025-10-31 07:24 ET
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, finalizePlatformVerification } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id as string | undefined;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Load OAuth accounts from NextAuth's Account table
    const accounts = await prisma.account.findMany({
      where: { userId },
      select: { provider: true, access_token: true, scope: true },
    });

    const results: Array<{ provider: string; ok: boolean; error?: string }> = [];

    for (const a of accounts) {
      if (!["google", "facebook", "twitter"].includes(a.provider)) continue;

      try {
        await finalizePlatformVerification({
          userId,
          provider: a.provider,
          accessToken: a.access_token ?? undefined,
          scope: a.scope ?? undefined,
        });
        results.push({ provider: a.provider, ok: true });
      } catch (err: any) {
        results.push({ provider: a.provider, ok: false, error: String(err?.message || err) });
      }
    }

    return NextResponse.json({ results }, { status: 200 });
  } catch (err: any) {
    console.error("POST /api/verify/platform/refresh error:", err);
    return NextResponse.json(
      { error: "Failed to refresh platform verification" },
      { status: 500 }
    );
  }
}
