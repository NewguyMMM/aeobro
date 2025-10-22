import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ADMIN_EMAILS = new Set<string>([
  "you@aeobro.com",
  "admin@aeobro.com",
]);

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email || "";
  if (!ADMIN_EMAILS.has(email)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const { profileId, status } = await req.json();
  const allowed = ["UNVERIFIED", "PLATFORM_VERIFIED", "DOMAIN_VERIFIED"];
  if (!profileId || !allowed.includes(status)) return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });

  await prisma.profile.update({ where: { id: profileId }, data: { verificationStatus: status } });
  return NextResponse.json({ ok: true, status });
}
