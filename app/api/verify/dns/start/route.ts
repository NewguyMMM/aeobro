// app/api/verify/dns/start/route.ts
// 📅 Updated: 2025-10-27 09:52 PM ET

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateVerificationToken, dnsRecordFor } from "@/lib/verification";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email || null;
    if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Resolve the user via email (avoid relying on session.user.id typing)
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Parse & normalize domain
    const body = await req.json().catch(() => ({} as any));
    const rawDomain = (body?.domain as string | undefined) || "";
    const cleanDomain = rawDomain.trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");
    if (!cleanDomain || cleanDomain.includes(" ")) {
      return NextResponse.json({ error: "Missing or invalid domain" }, { status: 400 });
    }

    // Claim ownership check
    const existing = await prisma.domainClaim.findUnique({
      where: { domain: cleanDomain },
      select: { userId: true },
    });
    if (existing && existing.userId !== user.id) {
      return NextResponse.json({ error: "Domain already claimed by another user" }, { status: 409 });
    }

    // Generate token + preferred DNS record (new format)
    const token = generateVerificationToken(16); // 32 hex chars
    const { recordHost, recordType, recordValue } = dnsRecordFor(cleanDomain, token);

    // Upsert claim, reset verification state
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

    // Return new record + accepted legacy alternatives (checker supports all)
    return NextResponse.json({
      recordHost,                 // _aeobro-verify.<domain>
      recordType,                 // "TXT"
      recordValue,                // aeobro-site-verify=<token>
      instructions: `Create a TXT record at ${recordHost} with value: ${recordValue} — then click “Check”.`,
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
    return NextResponse.json({ error: err?.message || "Server error" }, { status: 500 });
  }
}
