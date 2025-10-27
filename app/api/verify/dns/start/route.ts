import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import crypto from "crypto";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { domain } = await req.json();
  if (!domain) return NextResponse.json({ error: "Missing domain" }, { status: 400 });

  const txtToken = crypto.randomUUID();

  // One domain per claim; if it exists for this user, refresh token
  const existing = await prisma.domainClaim.findUnique({ where: { domain } });

  if (existing && existing.userId !== session.user.id) {
    return NextResponse.json({ error: "Domain already claimed by another user" }, { status: 409 });
  }

  await prisma.domainClaim.upsert({
    where: { domain },
    update: {
      userId: session.user.id,
      txtToken,
      dnsVerified: false,
      status: "PENDING",
      verifiedAt: null,
    },
    create: {
      userId: session.user.id,
      domain,
      txtToken,
      status: "PENDING",
    },
  });

  return NextResponse.json({
    recordHost: `_aeobro.${domain}`,
    recordType: "TXT",
    recordValue: txtToken,
    instructions: `Create a TXT at _aeobro.${domain} with value: ${txtToken}`,
  });
}
