// app/api/verify/bio-code/check/route.ts
// ✅ Updated: 2025-11-02 09:18 ET
// Fetches the public profileUrl, looks for the active code, and on success:
// - updates or creates a PlatformAccount (provider = <platform>, platformContext = "BIO_CODE")
// - sets verifiedAt, url, status = "VERIFIED"
// - promotes profile.verificationStatus to PLATFORM_VERIFIED (if not DOMAIN_VERIFIED)

export const runtime = "nodejs";

import { NextResponse } from "next/server";
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

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = await getAuthUserId(session);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: nocache() });
    }

    const { platform, profileUrl } = await req.json().catch(() => ({}));
    if (typeof platform !== "string" || !SUPPORTED_PLATFORMS.has(platform)) {
      return NextResponse.json(
        { error: "Invalid or unsupported platform" },
        { status: 400, headers: nocache() }
      );
    }
    if (!profileUrl || typeof profileUrl !== "string") {
      return NextResponse.json(
        { error: "profileUrl is required" },
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
          { verified: false, message: `Failed to fetch profileUrl (HTTP ${res.status})` },
          { status: 200, headers: nocache() }
        );
      }
      body = await res.text();
    } catch (e: any) {
      return NextResponse.json(
        { verified: false, message: "Unable to fetch profileUrl." },
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

    // 👉 Update or create a PlatformAccount using provider (not 'platform')
    // We avoid relying on a composite unique by using findFirst + conditional update/create.
    const existing = await prisma.platformAccount.findFirst({
      where: { userId, provider: platform },
      select: { id: true },
    });

    if (existing?.id) {
      await prisma.platformAccount.update({
        where: { id: existing.id },
        data: {
          provider: platform,
          // optional fields if your model has them:
          platformContext: "BIO_CODE" as any,
          url: profileUrl,
          status: "VERIFIED" as any,
          verifiedAt: new Date(),
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
          // externalId/handle can be filled later by an OAuth flow; not needed for code-in-bio
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
  } catch (err: any) {
    console.error("[bio-code/check] error:", err);
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
