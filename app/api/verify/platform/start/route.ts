// app/api/verify/platform/start/route.ts
// ✅ Updated: 2025-11-01 08:36 ET
// Legacy "start" endpoint used by VerificationCard to mint a code-in-bio marker.
// Fixes: include required `expiresAt` and `profileUrl`, remove non-existent `status`.

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
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Expected body: { platform: string, profileUrl: string, ttlHours?: number }
    const body = await req.json().catch(() => ({}));
    const platform: string | undefined = body?.platform;
    const profileUrl: string | undefined = body?.profileUrl;
    const ttlHours: number | undefined = body?.ttlHours;

    if (typeof platform !== "string" || !SUPPORTED_PLATFORMS.has(platform)) {
      return NextResponse.json({ error: "Invalid or unsupported platform" }, { status: 400 });
    }

    // For this route we REQUIRE a profileUrl because your Prisma model requires it.
    if (typeof profileUrl !== "string" || profileUrl.trim() === "") {
      return NextResponse.json({ error: "profileUrl is required" }, { status: 400 });
    }

    // Soft plan gate (same as other routes)
    const allowed = await ensurePlanAllowsBioCode(userId);
    if (!allowed.ok) {
      return NextResponse.json(
        { error: allowed.message ?? "Not allowed on current plan" },
        { status: 403 }
      );
    }

    const now = new Date();
    const ttl =
      typeof ttlHours === "number" && ttlHours > 0 && ttlHours <= 72
        ? ttlHours
        : BIO_CODE_TTL_HOURS_DEFAULT;
    const expiresAt = new Date(now.getTime() + ttl * 60 * 60 * 1000);

    // Reuse a valid unexpired code for this (user, platform) if one exists
    const existing = await prisma.bioCode.findFirst({
      where: { userId, platform, expiresAt: { gt: now } },
      orderBy: { createdAt: "desc" },
      select: { code: true, expiresAt: true },
    });

    if (existing) {
      return NextResponse.json({
        marker: existing.code,
        expiresAt: existing.expiresAt,
        instructions:
          "Paste this exact string in your bio/about. Then click “Check” in AEOBRO.",
      });
    }

    // Mint new token (same format used elsewhere)
    const rand = crypto.randomBytes(6).toString("base64url").slice(0, 8).toUpperCase();
    const code = `AEOBRO-${platform.toUpperCase()}-${rand}`;

    // IMPORTANT: include fields required by your Prisma model; do NOT include any nonexistent fields.
    const created = await prisma.bioCode.create({
      data: {
        userId,
        platform,
        profileUrl,    // ⬅ required by your model (non-nullable)
        code,
        expiresAt,     // ⬅ required by your model (non-nullable)
        // DO NOT pass `status` — it's not in your BioCode model
      },
      select: { code: true, expiresAt: true },
    });

    return NextResponse.json({
      marker: created.code,
      expiresAt: created.expiresAt,
      instructions:
        "Paste this exact string in your bio/about. Then click “Check” in AEOBRO.",
    });
  } catch (err: any) {
    console.error("[platform/start] error:", err);
    return NextResponse.json({ error: "Unable to start platform verification" }, { status: 500 });
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
    return allowed ? { ok: true } : { ok: false, message: "Please upgrade your plan to use Code-in-Bio verification." };
  } catch {
    return { ok: true };
  }
}
