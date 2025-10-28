// lib/verification.ts
// 📅 Updated: 2025-10-27 01:33 PM ET

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

/** ---------- Token utilities (profile-level, domain, platform) ---------- */

/** Generates a random hex token (default 16 bytes => 32 hex chars). */
export function generateVerificationToken(bytes = 16) {
  return randomBytes(bytes).toString("hex");
}

/** Alias for compatibility with examples that use `newToken()` */
export const newToken = generateVerificationToken;

/**
 * Ensure a persistent per-profile token exists (used for UI flows or links).
 * Note: This is separate from any per-domain TXT token. Keep both.
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

/** ---------- DNS verification helpers ---------- */

/**
 * New recommended DNS record:
 *   Host: _aeobro-verify.<domain>
 *   Type: TXT
 *   Value: aeobro-site-verify=<token>
 *
 * (This is what the UI shows in the VerificationCard.)
 */
export function dnsRecordFor(domain: string, token: string) {
  const clean = domain.replace(/^_aeobro-verify\./, "").trim();
  const host = `_aeobro-verify.${clean}`;
  const recordType = "TXT" as const;
  const recordValue = `aeobro-site-verify=${token}`;
  return { recordHost: host, recordType, recordValue };
}

/**
 * Backwards/forwards compatible TXT check.
 *
 * We will accept ANY of the following on ANY of these hosts:
 * Hosts checked (in order):
 *   1) _aeobro-verify.<domain>   (new)
 *   2) _aeobro.<domain>          (legacy)
 *   3) <domain>                  (fallback)
 *
 * TXT value patterns accepted:
 *   - "aeobro-site-verify=<token>"   (new)
 *   - "aeobro-verification=<token>"  (legacy)
 *   - "<token>"                      (bare token fallback)
 */
export async function checkDomainTxtForToken(
  domain: string,
  token: string
): Promise<boolean> {
  const resolver = new Resolver();

  const needleLower = token.trim().toLowerCase();
  const patterns = [
    `aeobro-site-verify=${needleLower}`,
    `aeobro-verification=${needleLower}`,
    needleLower, // bare token
  ];

  const hosts = [
    `_aeobro-verify.${domain}`,
    `_aeobro.${domain}`,
    domain,
  ];

  for (const host of hosts) {
    try {
      const records = await resolver.resolveTxt(host);
      // Each TXT answer is string[] chunks—join, normalize, and compare/includes
      const flattened = records
        .map(parts => parts.join(""))
        .map(s => s.trim().toLowerCase());

      const ok = flattened.some(s => patterns.some(p => s === p || s.includes(p)));
      if (ok) return true;
    } catch {
      // ignore resolution errors and try next host
    }
  }

  return false;
}

/** ---------- Platform verification helpers ---------- */

/**
 * Short, copyable snippet that can live in bios / descriptions.
 * Example: "aeobro-verify-<token>"
 */
export function platformMarker(token: string) {
  return `aeobro-verify-${token}`;
}

/**
 * Build public profile URLs from stored handles.
 * Match these keys to your Profile schema/editor.
 */
export function platformProfileUrls(handles: Record<string, string | undefined>) {
  const urls: string[] = [];
  if (handles.youtube) urls.push(`https://www.youtube.com/@${handles.youtube}`);
  if (handles.tiktok) urls.push(`https://www.tiktok.com/@${handles.tiktok}`);
  if (handles.instagram) urls.push(`https://www.instagram.com/${handles.instagram}`);
  if (handles.substack) urls.push(`https://${handles.substack}.substack.com/`);
  if (handles.etsy) urls.push(`https://www.etsy.com/shop/${handles.etsy}`);
  if (handles.x) urls.push(`https://twitter.com/${handles.x}`);
  if (handles.linkedin) urls.push(`https://www.linkedin.com/in/${handles.linkedin}`);
  if (handles.facebook) urls.push(`https://www.facebook.com/${handles.facebook}`);
  if (handles.github) urls.push(`https://github.com/${handles.github}`);
  return urls;
}
