// app/api/verify/platform/refresh/route.ts
// ✅ Updated: 2025-10-31 07:06 ET
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
// finalizePlatformVerification is defined in lib/auth.ts in the answer I gave you.
// If you kept it there, you can import it. If not, move it to lib/verify/finalizePlatformVerification.
import { /* @ts-ignore */ finalizePlatformVerification } from "@/lib/auth";

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Load the user's OAuth accounts from NextAuth's Account table
    const accounts = await prisma.account.findMany({
      where: { userId: session.user.id },
      select: { provider: true, access_token: true, scope: true },
    });

    const results: Array<{ provider: string; ok: boolean; error?: string }> = [];

    for (const a of accounts) {
      // Only providers we support for verification
      if (!["google", "facebook", "twitter"].includes(a.provider)) continue;

      try {
        await finalizePlatformVerification({
          userId: session.user.id,
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
