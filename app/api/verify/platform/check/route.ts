import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function pageContains(url: string, needle: string) {
  try {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) return false;
    const t = await r.text();
    return t.includes(needle);
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email || null;
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({} as any));
  const platform = body?.platform as string | undefined;

  const where = { userId: user.id, status: "PENDING" as const, ...(platform ? { platform } : {}) };

  // BioCode has no createdAt column; order by id for recency-ish sorting
  const pending = await prisma.bioCode.findMany({ where, orderBy: { id: "desc" } });
  if (pending.length === 0) {
    return NextResponse.json({ error: "No pending code-in-bio to check" }, { status: 404 });
  }

  for (const p of pending) {
    if (await pageContains(p.profileUrl, p.code)) {
      await prisma.$transaction(async (tx) => {
        await tx.bioCode.update({ where: { id: p.id }, data: { status: "VERIFIED", verifiedAt: new Date() } });

        const prof = await tx.profile.findUnique({ where: { userId: user.id } });
        const merged = {
          ...((prof?.verifiedPlatforms as any) || {}),
          [p.platform]: { url: p.profileUrl, code: p.code, verifiedAt: new Date().toISOString() },
        };

        await tx.profile.update({
          where: { userId: user.id },
          data: {
            verifiedPlatforms: merged,
            platformVerifiedAt: new Date(),
            verificationStatus: prof?.verificationStatus === "DOMAIN_VERIFIED" ? "DOMAIN_VERIFIED" : "PLATFORM_VERIFIED",
          },
        });
      });

      const final = await prisma.profile.findUnique({
        where: { userId: user.id },
        select: { verificationStatus: true },
      });
      return NextResponse.json({ ok: true, profile: final });
    }
  }

  return NextResponse.json({ ok: false, message: "Marker not found yet" }, { status: 404 });
}
