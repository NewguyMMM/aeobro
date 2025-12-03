// app/api/verify/domain/check/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { checkDnsTxt, candidateDnsNames, randomToken } from "@/lib/verify";
import { resend, FROM } from "@/lib/email";

export async function POST(req: Request) {
  const session = await auth();

  // TS-safe extraction of the id we inject in the NextAuth session callback
  const userId = (session as any)?.user?.id as string | undefined;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { claimId } = await req.json();
  if (!claimId) {
    return NextResponse.json({ error: "Missing claimId" }, { status: 400 });
  }

  const claim = await prisma.domainClaim.findUnique({ where: { id: claimId } });
  if (!claim || claim.userId !== userId) {
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

  // Optionally send a domain-email verification link once DNS is OK
  let emailQueued = false;
  if (dnsVerified && claim.emailIssued && !claim.emailToken) {
    const token = randomToken(96);
    await prisma.domainClaim.update({
      where: { id: claim.id },
      data: { emailToken: token },
    });

    const base = process.env.APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
    const url = `${base.replace(/\/$/, "")}/api/verify/domain/email-click?token=${token}`;

    const { error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || FROM.updates || "AEOBRO <noreply@aeobro.com>",
      to: claim.emailIssued,
      subject: `Verify ${claim.domain} email for AEOBRO`,
      html: `<p>Click to verify your domain email for <b>${claim.domain}</b>:</p><p><a href="${url}">${url}</a></p>`,
      text: `Verify your domain email for ${claim.domain}\n${url}\n`,
    });
    if (!error) emailQueued = true;
  }

  const updated = await prisma.domainClaim.update({
    where: { id: claim.id },
    data: {
      dnsVerified,
      status,
      verifiedAt: status === "VERIFIED" ? new Date() : null,
    },
  });

  // 🔥 NEW: propagate DNS verification to the Profile
  // We treat successful DNS (dnsVerified === true) as sufficient to mark the
  // profile as DOMAIN_VERIFIED, regardless of whether email is also verified.
  if (dnsVerified) {
    const now = new Date();
    await prisma.profile.updateMany({
      where: { userId },
      data: {
        verificationStatus: "DOMAIN_VERIFIED",
        domainVerifiedAt: now,
        verifyMethod: "DNS",
        verifyDomain: claim.domain,
        verifyCheckedAt: now,
      },
    });
  }

  return NextResponse.json({
    status: updated.status,
    dnsVerified,
    emailQueued,
  });
}
