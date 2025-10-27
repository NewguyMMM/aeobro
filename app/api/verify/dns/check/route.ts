import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
  const email = session?.user?.email || null;
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { domain } = await req.json();
  if (!domain) return NextResponse.json({ error: "Missing domain" }, { status: 400 });

  const claim = await prisma.domainClaim.findUnique({ where: { domain } });
  if (!claim || claim.userId !== user.id) {
    return NextResponse.json({ error: "No claim for this domain" }, { status: 404 });
  }

  const txts = await txtLookup(`_aeobro.${domain}`);
  if (!txts.includes(claim.txtToken)) {
    return NextResponse.json({ ok: false, message: "TXT not found yet" }, { status: 404 });
  }

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
      },
    });
  });

  return NextResponse.json({ ok: true, profile: { verificationStatus: "DOMAIN_VERIFIED" } });
}
