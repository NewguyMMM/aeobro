// app/api/verify/bio-code/generate/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import crypto from "crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Adjust if you support more platforms
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

    const { platform, ttlHours } = await req.json().catch(() => ({}));
    if (typeof platform !== "string" || !SUPPORTED_PLATFORMS.has(platform)) {
      return NextResponse.json(
        { error: "Invalid or unsupported platform" },
        { status: 400 }
      );
    }

    // Soft plan gate (tweak to your schema/policy if needed)
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

    // If a still-valid code exists for this (user, platform), re-use it
    const existing = await prisma.bioCode.findFirst({
      where: {
        userId,
        platform,
        // usedAt: null, // not used in your schema; rely on expiry
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: "desc" },
    });

    if (existing) {
      return NextResponse.json({
        platform,
        code: existing.code,
        expiresAt: existing.expiresAt,
        instructions:
          "Paste this exact string in your bio/about. Then click “Check now” in AEOBRO.",
      });
    }

    // Mint a fresh token
    const rand = crypto.randomBytes(6).toString("base64url").slice(0, 8).toUpperCase();
    const code = `AEOBRO-${platform.toUpperCase()}-${rand}`;

    const created = await prisma.bioCode.create({
      data: {
        userId,
        platform,
        code,
        expiresAt,
      },
      select: { code: true, expiresAt: true, platform: true },
    });

    return NextResponse.json({
      platform: created.platform,
      code: created.code,
      expiresAt: created.expiresAt,
      instructions:
        "Paste this exact string in your bio/about. Then click “Check now” in AEOBRO.",
    });
  } catch (err: any) {
    console.error("[bio-code/generate] error:", err);
    return NextResponse.json(
      { error: "Unable to generate BioCode" },
      { status: 500 }
    );
  }
}

/* -------------------- helpers -------------------- */

// Session → userId resolver (runtime safety)
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

// Soft-gating helper (adjust to your schema as needed)
async function ensurePlanAllowsBioCode(
  userId: string
): Promise<{ ok: true } | { ok: false; message?: string }> {
  try {
    const profile = await prisma.profile.findFirst({
      where: { userId },
      select: { plan: true },
    });
    const plan = (profile?.plan || "Lite").toLowerCase();
    const allowed = ["lite", "plus", "pro", "business", "enterprise"].includes(plan);
    if (!allowed) {
      return { ok: false, message: "Please upgrade your plan to use Code-in-Bio verification." };
    }
    return { ok: true };
  } catch {
    return { ok: true };
  }
}
