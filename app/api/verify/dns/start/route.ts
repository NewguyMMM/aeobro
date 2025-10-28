// app/api/verify/dns/start/route.ts
// 📅 Updated: 2025-10-27 01:44 PM ET

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateVerificationToken, dnsRecordFor } from "@/lib/verification";

/**
 * Starts a DNS verification for a domain.
 * Preferred record:
 *   Host: _aeobro-verify.<domain>
 *   Type: TXT
 *   Value: aeobro-site-verify=<token>
 *
 * For backward compatibility, we also return legacy alternatives that
 * your check route will accept (per lib/verification.ts):
 *   Host: _aeobro.<domain> or <domain>
 *   Value: aeobro-verification=<token> OR <token> (bare)
 */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id || null;
    const email = session?.user?.email || null;

    if (!userId && !email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Prefer looking up by userId if available
    let user = null as null | { id: string };
    if (userId) {
      user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    } else if (email) {
      user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    }
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { domain } = await req.json();
    if (!domain || typeof domain !== "string") {
      return NextResponse.json({ error: "Missing or invalid domain" }, { status: 400 });
    }

    // Normalize domain (light touch)
    const cleanDomain = domain.trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");
    if (!cleanDomain || cleanDomain.includes(" ")) {
      return NextResponse.json({ error: "Invalid domain format" }, { status: 400 });
    }

    // Ownership / uniqueness check
    const existing = await prisma.domainClaim.findUnique({
      where: { domain: cleanDomain },
      select: { userId: true },
    });
    if (existing && existing.userId !== user.id) {
      return NextResponse.json({ error: "Domain already claimed by another user" }, { status: 409 });
    }

    // Generate a fresh token and compute the preferred record
    const token = generateVerificationToken(16); // 32-hex chars
    const { recordHost, recordType, recordValue } = dnsRecordFor(cleanDomain, token);

    // Upsert domain claim with the new token and reset verification status
    await prisma.domainClaim.upsert({
      where: { domain: cleanDomain },
      update: {
        userId: user.id,
        txtToken: token,
        dnsVerified: false,
        status: "PENDING",
        verifiedAt: null,
      },
      create: {
        userId: user.id,
        domain: cleanDomain,
        txtToken: token,
        status: "PENDING",
      },
    });

    // Provide preferred instruction plus legacy-compatible alternatives
    return NextResponse.json({
      recordHost,          // _aeobro-verify.<domain>
      recordType,          // "TXT"
      recordValue,         // aeobro-site-verify=<token>
      instructions: `Create a TXT record at ${recordHost} with value: ${recordValue} — then click “Check”.`,
      // For UX clarity, include what else would be accepted by the checker:
      legacyAlternatives: [
        {
          recordHost: `_aeobro.${cleanDomain}`,
          recordType: "TXT",
          recordValue: `aeobro-verification=${token}`,
          note: "Legacy key style; also accepted.",
        },
        {
          recordHost: `_aeobro.${cleanDomain}`,
          recordType: "TXT",
          recordValue: token,
          note: "Bare token fallback; also accepted.",
        },
        {
          recordHost: cleanDomain,
          recordType: "TXT",
          recordValue: `aeobro-verification=${token}`,
          note: "Root-host legacy key style; also accepted.",
        },
        {
          recordHost: cleanDomain,
          recordType: "TXT",
          recordValue: token,
          note: "Root-host bare token fallback; also accepted.",
        },
      ],
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Server error" },
      { status: 500 }
    );
  }
}
