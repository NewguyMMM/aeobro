// app/api/verify/dns/check/route.ts
// 📅 Updated: 2025-10-27 09:48 PM ET

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** ---- Minimal DNS-over-HTTPS (Google) TXT lookup ---- */
async function dohTxtLookup(host: string): Promise<string[]> {
  try {
    const url = `https://dns.google/resolve?name=${encodeURIComponent(host)}&type=TXT`;
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) return [];
    const j = await r.json();
    const answers = (j?.Answer || []) as Array<{ data: string }>;
    // Normalize to lowercase plain strings (Google may return multi-chunk quoted strings)
    return answers
      .map(a => a.data)
      .map(s => s.replace(/^"|"$/g, "")) // strip outer quotes
      .map(s => s.replace(/\\"/g, `"`))  // unescape quotes
      .map(s => s.toLowerCase().trim());
  } catch {
    return [];
  }
}

/** Accept any of the supported record styles across the supported hosts */
async function dnsHasAnyAcceptedPattern(domain: string, token: string): Promise<boolean> {
  const needle = token.trim().toLowerCase();
  const patterns = [
    `aeobro-site-verify=${needle}`,  // new preferred
    `aeobro-verification=${needle}`, // legacy key
    needle,                          // bare token
  ];

  const hosts = [
    `_aeobro-verify.${domain}`, // new preferred host
    `_aeobro.${domain}`,        // legacy host
    domain,                     // root fallback
  ];

  for (const host of hosts) {
    const txts = await dohTxtLookup(host);
    if (txts.length === 0) continue;
    const match = txts.some(s => patterns.some(p => s === p || s.includes(p)));
    if (match) return true;
  }
  return false;
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email || null;
    if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Resolve user by email (avoids relying on session.user.id typing)
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Optional domain in body; normalize if present
    let bodyDomain: string | undefined;
    try {
      const body = await req.json();
      if (body?.domain && typeof body.domain === "string") {
        bodyDomain = body.domain.trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");
      }
    } catch {
      // empty or invalid JSON is fine
    }

    // Load claim: specific domain if provided, else latest for this user
    let claim = null as
      | (typeof prisma.domainClaim extends never ? never : {
          domain: string;
          txtToken: string;
          userId: string;
        })
      | null;

    if (bodyDomain) {
      const c = await prisma.domainClaim.findUnique({
        where: { domain: bodyDomain },
        select: { domain: true, txtToken: true, userId: true },
      });
      if (!c || c.userId !== user.id) {
        return NextResponse.json({ error: "No claim for this domain" }, { status: 404 });
      }
      claim = c;
    } else {
      const c = await prisma.domainClaim.findMany({
        where: { userId: user.id },
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
        take: 1,
        select: { domain: true, txtToken: true, userId: true },
      });
      claim = c[0] || null;
      if (!claim) {
        return NextResponse.json({ error: "No pending domain claim found for your account" }, { status: 404 });
      }
    }

    const domain = claim.domain;
    const token = claim.txtToken;

    const ok = await dnsHasAnyAcceptedPattern(domain, token);
    if (!ok) {
      return NextResponse.json(
        { ok: false, message: "TXT not found yet. DNS can take time to propagate—retry shortly." },
        { status: 200 }
      );
    }

    // Mark verified and flip profile status
    await prisma.$transaction(async (tx) => {
      await tx.domainClaim.update({
        where: { domain },
        data: { dnsVerified: true, status: "VERIFIED", verifiedAt: new Date() },
      });

      const prof = await tx.profile.findUnique({ where: { userId: user.id } });
      await tx.profile.update({
        where: { userId: user.id },
        data: {
          website: prof?.website ?? `https://${domain}`,
          verificationStatus: "DOMAIN_VERIFIED",
          domainVerifiedAt: new Date(),
          verifyCheckedAt: new Date(),
        },
      });
    });

    const final = await prisma.profile.findUnique({
      where: { userId: user.id },
      select: { verificationStatus: true },
    });

    return NextResponse.json({ ok: true, profile: final });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Server error" }, { status: 500 });
  }
}
