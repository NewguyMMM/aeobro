// app/api/verify/domain/request/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth-server"; // server-side session helper
import { upsertDomainClaim } from "@/lib/verify";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await auth();

  // TS-safe extraction of the id we inject in the NextAuth session callback
  const userId = (session as any)?.user?.id as string | undefined;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { domain, domainEmail } = await req.json();
  if (!domain) {
    return NextResponse.json({ error: "Missing domain" }, { status: 400 });
  }

  const claim = await upsertDomainClaim(userId, domain);

  // Optionally store intended domain email for the follow-up email click step
  if (domainEmail) {
    await prisma.domainClaim.update({
      where: { id: claim.id },
      data: { emailIssued: domainEmail },
    });
  }

  return NextResponse.json({
    id: claim.id,
    domain: claim.domain,
    txtToken: claim.txtToken,
  });
}
