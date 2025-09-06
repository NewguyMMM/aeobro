import { NextResponse } from "next/server";
import { auth } from "@/lib/auth-server"; // your helper to get session server-side
import { upsertDomainClaim } from "@/lib/verify";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { domain, domainEmail } = await req.json();
  if (!domain) return NextResponse.json({ error: "Missing domain" }, { status: 400 });

  const claim = await upsertDomainClaim(session.user.id, domain);

  // Optionally store intended domain email for link step
  if (domainEmail) {
    await prisma.domainClaim.update({
      where: { id: claim.id },
      data: { emailIssued: domainEmail },
    });
  }

  return NextResponse.json({ id: claim.id, domain: claim.domain, txtToken: claim.txtToken });
}
