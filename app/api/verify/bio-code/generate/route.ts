// app/api/verify/bio-code/generate/route.ts
// ✅ Creates (or reuses) a short-lived BioCode token per (user, platform).
// Method: POST
// Body: { platform: "github" | "x" | "instagram" | "tiktok" | "youtube" | "substack" | "etsy" | "linkedin" | "facebook" , ttlHours?: number }
// Returns: { code, platform, expiresAt, instructions }

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
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { platform, ttlHours } = await req.json().catch(() => ({}));
    if (typeof platform !== "string" || !SUPPORTED_PLATFORMS.has(platform)) {
      return NextResponse.json(
        { error: "Invalid or unsupported platform" },
        { status: 400 }
      );
    }

    // Optional soft-gating by plan (adjust the internals for your schema)
    const allowed = await ensurePlanAllowsBioCode(session.user.id);
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
        userId: session.user.id,
        platform,
        usedAt: null,
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
        userId: session.user.id,
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

// --- Soft-gating helper (adjust to your schema as needed) ---
async function ensurePlanAllowsBioCode(userId: string): Promise<{ ok: true } | { ok: false; message?: string }> {
  try {
    // Try common places a “plan/tier” might live. Tweak for your schema.
    const profile = await prisma.profile.findFirst({
      where: { userId },
      select: { plan: true }, // e.g., "Lite" | "Plus" | "Pro" | "Business"
    });

    const plan = (profile?.plan || "Lite").toLowerCase();
    // Example policy: Lite can generate tokens but with manual checks; Plus+ has full flow.
    const allowed = ["lite", "plus", "pro", "business", "enterprise"].includes(plan);
    if (!allowed) {
      return { ok: false, message: "Please upgrade your plan to use Code-in-Bio verification." };
    }
    return { ok: true };
  } catch {
    // If unsure, allow (soft gate) — logging still occurs.
    return { ok: true };
  }
}
