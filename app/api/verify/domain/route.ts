// app/api/verify/domain/route.ts
// AEOBRO — DNS TXT verification (with safe runtime + graceful rate limiting)
// Updated: 2025-10-29 10:58 ET

export const runtime = "nodejs";          // ensure Node (dns lookups etc.)
export const dynamic = "force-dynamic";   // always execute on server

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureProfileToken, checkDomainTxtForToken } from "@/lib/verification";

// ───────────────────────────────────────────────────────────────────────────────
// Rate limiting: 10 POSTs / hour per IP (graceful when Upstash env is missing)
// ───────────────────────────────────────────────────────────────────────────────
type Limiter = { limit: (key: string) => Promise<{ success: boolean }> };

let limiter: Limiter = {
  // default: no-op limiter (always allow)
  async limit() {
    return { success: true };
  },
};

try {
  // Only initialize if Upstash env vars exist; otherwise stay in "allow all" mode
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    const { Ratelimit } = await import("@upstash/ratelimit");
    const { Redis } = await import("@upstash/redis");
    const redis = Redis.fromEnv();
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.fixedWindow(10, "1 h"),
    }) as unknown as Limiter;
  }
} catch {
  // If Upstash packages/env are absent in some environments, keep permissive limiter
}

// Normalize an input like "https://www.example.com/path" → "example.com"
function normalizeDomain(input: string): string {
  const raw = (input || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw.includes("://") ? raw : `https://${raw}`);
    return url.hostname.replace(/^www\./i, "");
  } catch {
    return raw.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0].trim();
  }
}

// Preferred TXT record helpers (UI shows these; backend accepts legacy under the hood)
function preferredHost(apex: string) {
  return `_aeobro-verify.${apex}`;
}
function preferredValue(token: string) {
  return `aeobro-site-verify=${token}`;
}

export async function POST(req: Request) {
  // Auth
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit
  const fwd = req.headers.get("x-forwarded-for") || "";
  const ip = fwd.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  const { success } = await limiter.limit(ip);
  if (!success) {
    return NextResponse.json(
      { ok: false, error: "Too many verification requests. Please wait before retrying." },
      { status: 429 }
    );
  }

  // Parse body safely
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const profileId = body?.profileId as string | undefined;
  const inputDomain = body?.domain as string | undefined;
  const init = Boolean(body?.init);

  if (!profileId || !inputDomain) {
    return NextResponse.json(
      { ok: false, error: "Missing profileId or domain" },
      { status: 400 }
    );
  }

  const domain = normalizeDomain(inputDomain);
  if (!domain) {
    return NextResponse.json({ ok: false, error: "Invalid domain" }, { status: 400 });
  }

  // Ownership of profile
  const profile = await prisma.profile.findFirst({
    where: { id: profileId, user: { email: session.user.email } },
    select: { id: true, verificationStatus: true, verificationToken: true },
  });
  if (!profile) {
    return NextResponse.json({ ok: false, error: "Profile not found" }, { status: 404 });
  }

  // INIT: issue token & show preferred TXT format
  if (init) {
    const token = await ensureProfileToken(profile.id);
    return NextResponse.json({
      ok: true,
      token,
      status: profile.verificationStatus || "UNVERIFIED",
      instructions: [
        `Add a TXT record at Host: ${preferredHost(domain)}`,
        `Type: TXT`,
        `Value: ${preferredValue(token)}`,
        `Note: DNS changes can take time to propagate.`,
      ],
      // for any legacy consumers
      recordHost: preferredHost(domain),
      recordType: "TXT",
      recordValue: preferredValue(token),
    });
  }

  // CHECK: look up TXT & promote if matched
  const token = profile.verificationToken ?? (await ensureProfileToken(profile.id));

  // Accept preferred + legacy formats under the hood
  const found = await checkDomainTxtForToken(domain, token);

  if (!found) {
    return NextResponse.json({
      ok: true,
      verified: false,
      status: profile.verificationStatus || "UNVERIFIED",
      token, // UI can echo the exact value to copy
      message: "TXT record not detected yet",
    });
  }

  await prisma.profile.update({
    where: { id: profile.id },
    data: {
      verificationStatus: "DOMAIN_VERIFIED",
      domainVerifiedAt: new Date(),
    },
  });

  return NextResponse.json({
    ok: true,
    verified: true,
    status: "DOMAIN_VERIFIED",
    token,
  });
}
