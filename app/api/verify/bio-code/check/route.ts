// app/api/verify/bio-code/check/route.ts
// ✅ Updated: 2026-01-19
// - Server-side hardening: reject unsupported Code-in-Bio platforms (x | substack | github | etsy) with HTTP 400
// - Minimal validation: require valid profileUrl (http/https) with HTTP 400
// Behavior:
// - fetches profileUrl, finds active code, verifies
// - update/create PlatformAccount (provider=<platform>, platformContext="BIO_CODE", externalId from URL)
// - sets verifiedAt, url, status="VERIFIED"
// - promotes profile.verificationStatus to PLATFORM_VERIFIED (unless already DOMAIN_VERIFIED)

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ALLOWED_BIO_CODE_PLATFORMS = new Set(["github", "x", "substack", "etsy"]);

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = await getAuthUserId(session);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: nocache() });
    }

    const { platform: rawPlatform, profileUrl } = await req.json().catch(() => ({}));

    const platform =
      typeof rawPlatform === "string" ? rawPlatform.trim().toLowerCase() : "";

    if (!platform || !ALLOWED_BIO_CODE_PLATFORMS.has(platform)) {
      return NextResponse.json(
        { ok: false, error: "Unsupported platform for Code-in-Bio." },
        { status: 400, headers: nocache() }
      );
    }

    if (typeof profileUrl !== "string" || !isValidHttpUrl(profileUrl)) {
      return NextResponse.json(
        { ok: false, error: "Invalid or missing profileUrl." },
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

    // Get the most recent, unexpired code for this user+platform
    const now = new Date();
    const active = await prisma.bioCode.findFirst({
      where: { userId, platform, expiresAt: { gt: now } },
      orderBy: { createdAt: "desc" },
      select: { code: true, expiresAt: true },
    });

    if (!active?.code) {
      return NextResponse.json(
        { verified: false, message: "No active code found. Generate a new code first." },
        { status: 200, headers: nocache() }
      );
    }

    // Fetch the public bio/profile page
    let body = "";
    try {
      const res = await fetch(profileUrl, { method: "GET" });
      if (!res.ok) {
        return NextResponse.json(
          {
            verified: false,
            message:
              "Platform not supported for Code-in-Bio verification (unable to read your public profile page). Please use OAuth instead if available.",
          },
          { status: 200, headers: nocache() }
        );
      }
      body = await res.text();
    } catch {
      return NextResponse.json(
        {
          verified: false,
          message:
            "Platform not supported for Code-in-Bio verification. Please use OAuth instead if available.",
        },
        { status: 200, headers: nocache() }
      );
    }

    // Case-insensitive search for code in the page body
    const found = body.toLowerCase().includes(active.code.toLowerCase());
    if (!found) {
      return NextResponse.json(
        {
          verified: false,
          message:
            "Verification text not found on your public bio. Make sure the code is visible and the profile is public.",
        },
        { status: 200, headers: nocache() }
      );
    }

    // Build a stable externalId from the profileUrl (host + path, lowercase)
    const externalId = deriveExternalId(profileUrl);

    // Update or create a PlatformAccount using provider (not 'platform')
    const existing = await prisma.platformAccount.findFirst({
      where: { userId, provider: platform },
      select: { id: true },
    });

    if (existing?.id) {
      await prisma.platformAccount.update({
        where: { id: existing.id },
        data: {
          provider: platform,
          platformContext: "BIO_CODE" as any,
          url: profileUrl,
          status: "VERIFIED" as any,
          verifiedAt: new Date(),
          externalId,
        },
      });
    } else {
      await prisma.platformAccount.create({
        data: {
          userId,
          provider: platform,
          platformContext: "BIO_CODE" as any,
          url: profileUrl,
          status: "VERIFIED" as any,
          verifiedAt: new Date(),
          externalId, // ✅ required by your Prisma model
        },
      });
    }

    // Promote profile.verificationStatus if not already DOMAIN_VERIFIED
    const current = await prisma.profile.findFirst({
      where: { userId },
      select: { verificationStatus: true },
    });

    if (current?.verificationStatus !== "DOMAIN_VERIFIED") {
      await prisma.profile.update({
        where: { userId },
        data: { verificationStatus: "PLATFORM_VERIFIED" },
      });
    }

    return NextResponse.json(
      {
        ok: true,
        verified: true,
        platform,
        profileUrl,
        message: "Platform verified via Code-in-Bio.",
      },
      { status: 200, headers: nocache() }
    );
  } catch {
    // Minimal logging (no tokens / URLs)
    console.error("[bio-code/check] error");
    return NextResponse.json(
      { error: "Unable to complete Code-in-Bio check" },
      { status: 500, headers: nocache() }
    );
  }
}

/* -------------------- helpers -------------------- */

function nocache() {
  return { "Cache-Control": "no-store" };
}

function isValidHttpUrl(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function deriveExternalId(profileUrl: string): string {
  try {
    const u = new URL(profileUrl);
    const id = `${u.hostname}${u.pathname}`.replace(/\/+$/, "").toLowerCase();
    return id || profileUrl.toLowerCase();
  } catch {
    return profileUrl.toLowerCase();
  }
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
