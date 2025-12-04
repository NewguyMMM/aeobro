// app/api/verify/bio-code/generate/route.ts
// ✅ Updated: 2025-12-03
// Returns { ok: true, platform, code, expiresAt: ISO, profileUrl }, reuses unexpired codes.

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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: nocache() });
    }

    const { platform, ttlHours, profileUrl } = await req.json().catch(() => ({}));
    if (typeof platform !== "string" || !SUPPORTED_PLATFORMS.has(platform)) {
      return NextResponse.json(
        { error: "Invalid or unsupported platform" },
        { status: 400, headers: nocache() }
      );
    }

    const allowed = await ensurePlanAllowsBioCode(userId);
    if (!allowed.ok) {
      return NextResponse.json(
        { error: allowed.message ?? "Not allowed on current plan" },
        { status: 403, headers: nocache() }
      );
    }

    const now = new Date();
    const ttl =
      typeof ttlHours === "number" && ttlHours > 0 && ttlHours <= 72
        ? ttlHours
        : BIO_CODE_TTL_HOURS_DEFAULT;
    const expiresAt = new Date(now.getTime() + ttl * 60 * 60 * 1000);

    // Reuse an existing valid code if present
    const existing = await prisma.bioCode.findFirst({
      where: { userId, platform, expiresAt: { gt: now } },
      orderBy: { createdAt: "desc" },
      select: { code: true, expiresAt: true, platform: true, profileUrl: true },
    });

    if (existing) {
      return NextResponse.json(
        {
          ok: true,
          platform: existing.platform,
          code: existing.code,
          expiresAt: new Date(existing.expiresAt).toISOString(),
          profileUrl: profileUrl ?? existing.profileUrl ?? "",
          instructions:
            "Paste this exact string in your bio/about. Then click “Check now” in AEOBRO.",
        },
        { status: 200, headers: nocache() }
      );
    }

    // Mint new code
    const rand = crypto.randomBytes(6).toString("base64url").slice(0, 8).toUpperCase();
    const code = `AEOBRO-${platform.toUpperCase()}-${rand}`;

    const created = await prisma.bioCode.create({
      data: {
        userId,
        platform,
        code,
        expiresAt,
        profileUrl: profileUrl ?? "", // Prisma requires this
      },
      select: { code: true, expiresAt: true, platform: true, profileUrl: true },
    });

    return NextResponse.json(
      {
        ok: true,
        platform: created.platform,
        code: created.code,
        expiresAt: new Date(created.expiresAt).toISOString(),
        profileUrl: created.profileUrl ?? "",
        instructions:
          "Paste this exact string in your bio/about. Then click “Check now” in AEOBRO.",
      },
      { status: 200, headers: nocache() }
    );
  } catch (err: any) {
    console.error("[bio-code/generate] error:", err);
    return NextResponse.json(
      { error: "Unable to generate BioCode" },
      { status: 500, headers: nocache() }
    );
  }
}

/* -------------------- helpers -------------------- */

function nocache() {
  return { "Cache-Control": "no-store" };
}

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
    const plan =
      typeof raw === "string" ? raw.toLowerCase() : String(raw ?? "Lite").toLowerCase();

    const allowed = ["lite", "plus", "pro", "business", "enterprise"].includes(plan);
    if (!allowed) {
      return { ok: false, message: "Please upgrade your plan to use Code-in-Bio verification." };
    }
    return { ok: true };
  } catch {
    return { ok: true };
  }
}
