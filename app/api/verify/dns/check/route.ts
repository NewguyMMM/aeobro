import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

async function txtLookup(host: string): Promise<string[]> {
  try {
    const r = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(host)}&type=TXT`, { cache: "no-store" });
    if (!r.ok) return [];
    const j = await r.json();
    const ans = (j?.Answer || []) as Array<{ data: string }>;
    return ans.map(a => a.data.replace(/^"|"$/g, ""));
  } catch {
    return [];
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { domain } = await req.json();
  if (!domain) return NextResponse.json({ error: "Missing domain" }, { status: 400 });

  const claim = await prisma.domainClaim.findUnique({ where: { domain } });
  if (!claim || claim.userId !== session.user.id) {
    return NextResponse.json({ error: "No claim for this domain" }, { status: 404 });
  }

  const txts = await txtLookup(`_aeobro.${domain}`);
  if (!txts.includes(claim.txtToken)) {
    return NextResponse.json({ ok: false, message: "TXT not found yet" }, { status: 404 });
  }

  // Mark claim + upgrade profile
  await prisma.$transaction(async (tx) => {
    await tx.domainClaim.update({
      where: { domain },
      data: { dnsVerified: true, status: "VERIFIED", verifiedAt: new Date() },
    });

    // Set website if empty; flip badge to DOMAIN_VERIFIED
    await tx.profile.update({
      where: { userId: session.user.id },
      data: {
        website: (await tx.profile.findUnique({ where: { userId: session.user.id } }))?.website ?? `https://${domain}`,
        verificationStatus: "DOMAIN_VERIFIED",
        domainVerifiedAt: new Date(),
      },
    });
  });

  return NextResponse.json({ ok: true, profile: { verificationStatus: "DOMAIN_VERIFIED" } });
}
