// lib/verify.ts
import crypto from "node:crypto";
import { promises as dns } from "node:dns";
import { prisma } from "@/lib/prisma";

/** Generate a random hex token (default 128 bits). */
export function randomToken(bits: number = 128) {
  return crypto.randomBytes(bits / 8).toString("hex");
}

/** Check TXT records on a host for an expected value (substring match). */
export async function checkDnsTxt(hostname: string, expectedValue: string) {
  try {
    const records = await dns.resolveTxt(hostname);
    const flat = records.flat().map(r => r.toString());
    return flat.some(v => v.includes(expectedValue));
  } catch {
    return false;
  }
}

/** Fetch text/HTML from a URL (used by code-in-bio checks). */
export async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "user-agent": "AEOBRO-VerifyBot/1.0 (+https://aeobro.com)" },
    cache: "no-store",
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`Fetch failed ${res.status}`);
  return await res.text();
}

/** Create or refresh a DomainClaim with a new TXT token. */
export async function upsertDomainClaim(userId: string, domain: string) {
  const txtToken = `aeobro-verify=${randomToken(96)}`;
  return prisma.domainClaim.upsert({
    where: { domain },
    create: { userId, domain, txtToken },
    update: { userId, txtToken, status: "PENDING" },
  });
}

/** Where we’ll look for TXT: root and _aeobro subdomain. */
export function candidateDnsNames(domain: string) {
  return [domain, `_aeobro.${domain}`];
}
