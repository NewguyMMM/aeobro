// app/api/verify/bio/request/route.ts
// ✅ Updated: 2025-11-01 07:22 ET
// Legacy alias for "bio-code/generate" — keeps old clients working.

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import crypto from "crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const SUPPORTED_PLATFORMS = new Set([
  "github",
  "x",
  "instagram",
  "tiktok",
  "youtube",
  "substack",
  "etsy",
  "linkedin",
  "facebook",
]);

const BIO_CODE_TTL_HOURS_DEFAULT = 24;

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = await getAuthUserId(session);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Legacy body: { platform, profileUrl?, ttlHours? }
    const { platform, profileUrl, ttlHours } = await req.json().catch(() => ({}));

    if (typeof platform !== "string" || !SUPPORTED_PLATFORMS.has(platform)) {
      return NextResponse.json(
        { error: "Invalid or unsupported platform" },
        { status: 400 }
      );
    }

    // Soft plan gate (same logic as new endpoints)
    const allowed = await ensurePlanAllowsBioCode(userId);
    if (!allowed.ok) {
      return NextResponse.json(
        { error: allowed.message ?? "Not allowed on current plan" },
        { status: 403 }
      );
    }

    const now = new Date();
    const ttlHoursNum =
      typeof ttlHours === "number" && ttlHours > 0 && ttlHours <= 72
        ? ttlHours
        : BIO_CODE_TTL_HOURS_DEFAULT;
    const expiresAt = new Date(now.getTime() + ttlHoursNum * 60 * 60 * 1000);

    // Reuse an existing valid code if present (keeps UX stable)
    const existing = await prisma.bioCode.findFirst({
      where: { userId, platform, expiresAt: { gt: now } },
      orderBy: { createdAt: "desc" },
      select: { code: true, expiresAt: true, platform: true },
    });

    if (existing) {
      return NextResponse.json({
        ok: true,
        platform: existing.platform,
        code: existing.code,
        expiresAt: existing.expiresAt,
        // keep legacy response lenient
        instructions:
          "Paste this exact string in your bio/about. Then click “Check now” in AEOBRO.",
      });
    }

    // Mint a fresh token (same format as /bio-code/generate)
    const rand = crypto.randomBytes(6).toString("base64url").slice(0, 8).toUpperCase();
    const code = `AEOBRO-${platform.toUpperCase()}-${rand}`;

    // IMPORTANT: only include fields that exist on your Prisma model.
    // Do NOT pass "status" here; ensure "expiresAt" is provided.
    const created = await prisma.bioCode.create({
      data: {
        userId,
        platform,
        code,
        expiresAt,
        // If your model has a `profileUrl` column, you can uncomment the next line.
        // profileUrl,
      },
      select: { code: true, expiresAt: true, platform: true },
    });

    return NextResponse.json({
      ok: true,
      platform: created.platform,
      code: created.code,
      expiresAt: created.expiresAt,
      instructions:
        "Paste this exact string in your bio/about. Then click “Check now” in AEOBRO.",
    });
  } catch (err: any) {
    console.error("[verify/bio/request] error:", err);
    return NextResponse.json({ error: "Unable to generate BioCode" }, { status: 500 });
  }
}

/* -------------------- helpers -------------------- */

async function getAuthUserId(session: any): Promise<string | null> {
  const id = session?.user?.id;
  if (typeof id === "string" && id) return id;

  const email = session?.user?.email;
  if (typeof email === "string" && email) {
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (user?.id) return user.id;
  }
  return null;
}

async function ensurePlanAllowsBioCode(
  userId: string
): Promise<{ ok: true } | { ok: false; message?: string }> {
  try {
    const profile = await prisma.profile.findFirst({ where: { userId } });
    const raw =
      (profile as any)?.plan ??
      (profile as any)?.tier ??
      (profile as any)?.subscriptionPlan ??
      "Lite";
    const plan = typeof raw === "string" ? raw.toLowerCase() : String(raw ?? "Lite").toLowerCase();

    const allowed = ["lite", "plus", "pro", "business", "enterprise"].includes(plan);
    if (!allowed) {
      return { ok: false, message: "Please upgrade your plan to use Code-in-Bio verification." };
    }
    return { ok: true };
  } catch {
    // Soft-allow on lookup failure
    return { ok: true };
  }
}
