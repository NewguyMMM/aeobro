import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  if (!token) return NextResponse.redirect("/dashboard/verification?email=missing");

  const claim = await prisma.domainClaim.findFirst({ where: { emailToken: token } });
  if (!claim) return NextResponse.redirect("/dashboard/verification?email=invalid");

  const updated = await prisma.domainClaim.update({
    where: { id: claim.id },
    data: {
      emailVerified: true,
      status: claim.dnsVerified ? "VERIFIED" : "PARTIAL",
      verifiedAt: claim.dnsVerified ? new Date() : null,
      emailToken: null,
    },
  });

  return NextResponse.redirect("/dashboard/verification?email=ok");
}
