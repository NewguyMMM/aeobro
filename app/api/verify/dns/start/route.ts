import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email || null;
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { domain } = await req.json();
  if (!domain) return NextResponse.json({ error: "Missing domain" }, { status: 400 });

  const txtToken = crypto.randomUUID();

  const existing = await prisma.domainClaim.findUnique({ where: { domain } });
  if (existing && existing.userId !== user.id) {
    return NextResponse.json({ error: "Domain already claimed by another user" }, { status: 409 });
  }

  await prisma.domainClaim.upsert({
    where: { domain },
    update: { userId: user.id, txtToken, dnsVerified: false, status: "PENDING", verifiedAt: null },
    create: { userId: user.id, domain, txtToken, status: "PENDING" },
  });

  return NextResponse.json({
    recordHost: `_aeobro.${domain}`,
    recordType: "TXT",
    recordValue: txtToken,
    instructions: `Create a TXT at _aeobro.${domain} with value: ${txtToken}`,
  });
}
