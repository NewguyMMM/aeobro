// app/api/verify/domain/check/route.ts
export const runtime = "nodejs"; // ensure Node.js runtime for dns/crypto

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { checkDnsTxt, candidateDnsNames, randomToken } from "@/lib/verify";
import { resend, FROM } from "@/lib/email";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { claimId } = await req.json();
  if (!claimId) {
    return NextResponse.json({ error: "Missing claimId" }, { status: 400 });
  }

  const claim = await prisma.domainClaim.findUnique({ where: { id: claimId } });
  if (!claim || claim.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const names = candidateDnsNames(claim.domain);
  const dnsOk = await (async () => {
    for (const name of names) {
      if (await checkDnsTxt(name, claim.txtToken)) return true;
    }
    return false;
  })();

  let status = claim.status;
  let dnsVerified = claim.dnsVerified;

  if (dnsOk) {
    dnsVerified = true;
    status = claim.emailVerified ? "VERIFIED" : "PARTIAL";
  }

  // if domain email step is configured, handle here...

  const updated = await prisma.domainClaim.update({
    where: { id: claim.id },
    data: {
      dnsVerified,
      status,
      verifiedAt: status === "VERIFIED" ? new Date() : null,
    },
  });

  return NextResponse.json({ status: updated.status, dnsVerified });
}
