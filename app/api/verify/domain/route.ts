import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureProfileToken, checkDomainTxtForToken } from "@/lib/verification";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { profileId, domain, init } = await req.json();
  if (!profileId || !domain) return NextResponse.json({ ok: false, error: "Missing profileId or domain" }, { status: 400 });

  const profile = await prisma.profile.findFirst({
    where: { id: profileId, user: { email: session.user.email } },
    select: { id: true, verificationStatus: true, verificationToken: true },
  });
  if (!profile) return NextResponse.json({ ok: false, error: "Profile not found" }, { status: 404 });

  if (init) {
    const token = await ensureProfileToken(profile.id);
    return NextResponse.json({
      ok: true,
      token,
      instructions: [
        `Create a TXT record at ${domain} with value: aeobro-verification=${token}`,
        `Alternatively, create at _aeobro.${domain} with the same value.`,
      ],
    });
  }

  const token = profile.verificationToken ?? (await ensureProfileToken(profile.id));
  const found = await checkDomainTxtForToken(domain, token);

  if (!found) return NextResponse.json({ ok: true, verified: false, message: "TXT record not detected yet" });

  await prisma.profile.update({
    where: { id: profile.id },
    data: { verificationStatus: "DOMAIN_VERIFIED", domainVerifiedAt: new Date() },
  });

  return NextResponse.json({ ok: true, verified: true, status: "DOMAIN_VERIFIED" });
}
