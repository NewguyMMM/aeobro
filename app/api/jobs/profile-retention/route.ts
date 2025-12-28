// app/api/jobs/profile-retention/route.ts
// ✅ Created: 2025-12-28 05:33 ET
// Daily cron job:
// - Finds UNPUBLISHED profiles due to SUBSCRIPTION_LAPSED with retentionUntil <= now
// - Soft-deletes them (visibility=DELETED, deletedAt=now)
// Secured via CRON_SECRET (Authorization Bearer OR ?secret=)

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CRON_SECRET = process.env.CRON_SECRET as string | undefined;

function isAuthorized(req: Request) {
  if (!CRON_SECRET) return false;

  const auth = req.headers.get("authorization");
  if (auth && auth.startsWith("Bearer ")) {
    const token = auth.slice("Bearer ".length).trim();
    if (token && token === CRON_SECRET) return true;
  }

  const url = new URL(req.url);
  const q = url.searchParams.get("secret");
  if (q && q === CRON_SECRET) return true;

  return false;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const now = new Date();
  const lockStaleBefore = new Date(now.getTime() - 30 * 60 * 1000); // 30 minutes
  const BATCH = 200;

  try {
    // 1) Find candidates (not locked or lock is stale)
    const candidates = await prisma.profile.findMany({
      where: {
        visibility: "UNPUBLISHED",
        unpublishReason: "SUBSCRIPTION_LAPSED" as any,
        deletedAt: null,
        retentionUntil: { lte: now },
        OR: [
          { deletionJobLockedAt: null },
          { deletionJobLockedAt: { lt: lockStaleBefore } },
        ],
      },
      select: { id: true },
      take: BATCH,
    });

    if (candidates.length === 0) {
      return NextResponse.json({ ok: true, processed: 0 });
    }

    const ids = candidates.map((c) => c.id);

    // 2) Lock them (avoid overlap if cron runs twice)
    await prisma.profile.updateMany({
      where: { id: { in: ids } },
      data: { deletionJobLockedAt: now },
    });

    // 3) Soft delete
    const result = await prisma.profile.updateMany({
      where: { id: { in: ids } },
      data: {
        visibility: "DELETED",
        deletedAt: now,
      },
    });

    return NextResponse.json({
      ok: true,
      processed: result.count,
      batch: ids.length,
    });
  } catch (err: any) {
    console.error("❌ profile-retention job error:", err);
    return new NextResponse("Job error", { status: 500 });
  }
}
