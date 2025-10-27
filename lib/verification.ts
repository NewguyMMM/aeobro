// lib/verification.ts
// Updated: 2025-10-27 12:56 ET

import { randomBytes } from "crypto";
import { Resolver } from "dns/promises";
import { prisma } from "@/lib/prisma";

/** ---------- Soft-gating helpers ---------- */

/** True if profile is allowed to syndicate/export externally */
export function isVerified(level?: string | null): boolean {
  return level === "DOMAIN_VERIFIED" || level === "PLATFORM_VERIFIED";
}

/**
 * Throws a 403-style error unless the user's profile is verified.
 * Use at the top of export/syndication API routes.
 *
 * Example:
 *   await requireVerifiedForExport(session.user.id)
 */
export async function requireVerifiedForExport(userId: string) {
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { verificationStatus: true },
  });
  if (!profile) {
    const err: any = new Error("Profile not found");
    err.status = 404;
    throw err;
  }
  if (!isVerified(profile.verificationStatus)) {
    const err: any = new Error("Verification required for external syndication");
    err.status = 403;
    throw err;
  }
  return profile;
}

/** ---------- Token utilities (domain + in-app) ---------- */

export function generateVerificationToken() {
  return randomBytes(16).toString("hex");
}

/**
 * Ensure a persistent per-profile token exists (used for UI flows or links).
 * Note: This is separate from DomainClaim.txtToken (per-domain). Keep both.
 */
export async function ensureProfileToken(profileId: string) {
  const profile = await prisma.profile.findUnique({
    where: { id: profileId },
    select: { verificationToken: true },
  });
  if (profile?.verificationToken) return profile.verificationToken;

  const token = generateVerificationToken();
  await prisma.profile.update({
    where: { id: profileId },
    data: { verificationToken: token },
  });
  return token;
}

/**
 * Check TXT records for either:
 *   - aeobro-verification=<token>
 *   - <token> (bare)
 * on both <domain> and _aeobro.<domain>
 *
 * Uses system resolver (no extra envs). Intended for manual checks or CRON.
 * Your API route may alternatively use a public resolver via fetch if preferred.
 */
export async function checkDomainTxtForToken(domain: string, token: string): Promise<boolean> {
  const resolver = new Resolver();
  const hosts = [domain, `_aeobro.${domain}`];
  const needleLower = token.trim().toLowerCase();
  const kvNeedle = `aeobro-verification=${needleLower}`;

  for (const host of hosts) {
    try {
      const records = await resolver.resolveTxt(host);
      // Each TXT answer is string[] chunks—join, normalize, and compare
      const flattened = records
        .map(parts => parts.join(""))
        .map(s => s.trim().toLowerCase());

      if (flattened.some(s => s.includes(kvNeedle) || s === needleLower)) {
        return true;
      }
    } catch {
      // ignore resolution errors and try next host
    }
  }
  return false;
}
