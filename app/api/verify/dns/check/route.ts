// app/api/verify/dns/check/route.ts
// 📅 Updated: 2025-10-27 01:56 PM ET

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
    // Google DoH returns TXT as one or more quoted strings; sometimes multiple “chunks”
    // Example: "\"aeobro-site-verify=abc\" \"def\"" or "\"single\""
    // Normalize to plain strings, lowercased.
    const normalized = answers
      .map(a => a.data)
      .map(s => s.replace(/^"|"$/g, "")) // strip 1st/last quote pair if present
      .map(s => s.replace(/\\"/g, `"`))   // unescape quotes
      .map(s => s.toLowerCase().trim());
    return normalized;
  } catch {
    return [];
  }
}

/** Return true if any TXT on any host matches one of the accepted patterns */
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

    // TXT answers can contain multiple tokens concatenated; we accept either exact or includes
    const match = txts.some(s => patterns.some(p => s === p || s.includes(p)));
    if (match) return true;
  }
  return false;
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id || null;
    const email = session?.user?.email || null;

    if (!userId && !email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Resolve user by id first (preferred), else by email for backward compat
    let user = null as null | { id: string };
    if (userId) {
      user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    } else if (email) {
      user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    }
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Accept optional domain in body; if absent, use most recently updated claim for this user
    let bodyDomain: string | undefined;
    try {
      const body = await req.json();
      if (body?.domain && typeof body.domain === "string") {
        bodyDomain = body.domain.trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");
      }
    } catch {
      // ignore JSON parse errors (empty body)
    }

    let claim = null as any;

    if (bodyDomain) {
      claim = await prisma.domainClaim.findUnique({
        where: { domain: bodyDomain },
      });
      if (!claim || claim.userId !== user.id) {
        return NextResponse.json({ error: "No claim for this domain" }, { status: 404 });
      }
    } else {
      // Fallback to latest claim for user
      const claims = await prisma.domainClaim.findMany({
        where: { userId: user.id },
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
        take: 1,
      });
      claim = claims[0];
      if (!claim) {
        return NextResponse.json({ error: "No pending domain claim found for your account" }, { status: 404 });
      }
    }

    const domain = claim.domain as string;
    const token = (claim.txtToken as string) || "";

    if (!domain || !token) {
      return NextResponse.json({ error: "Claim record incomplete" }, { status: 400 });
    }

    const ok = await dnsHasAnyAcceptedPattern(domain, token);
    if (!ok) {
      return NextResponse.json(
        { ok: false, message: "TXT not found yet. It can take time to propagate—try again shortly." },
        { status: 200 }
      );
    }

    // Mark domain claim verified and flip profile verification
    await prisma.$transaction(async (tx) => {
      await tx.domainClaim.update({
        where: { domain },
        data: { dnsVerified: true, status: "VERIFIED", verifiedAt: new Date() },
      });

      const prof = await tx.profile.findUnique({ where: { userId: user!.id } });
      await tx.profile.update({
        where: { userId: user!.id },
        data: {
          website: prof?.website ?? `https://${domain}`,
          verificationStatus: "DOMAIN_VERIFIED",
          domainVerifiedAt: new Date(),
        },
      });
    });

    return NextResponse.json({ ok: true, profile: { verificationStatus: "DOMAIN_VERIFIED" } });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Server error" }, { status: 500 });
  }
}
