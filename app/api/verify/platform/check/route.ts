import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

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
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { platform } = await req.json(); // optional filter
  const where = { userId: session.user.id, status: "PENDING" as const, ...(platform ? { platform } : {}) };

  const pending = await prisma.bioCode.findMany({ where, orderBy: { createdAt: "desc" as const } });
  if (pending.length === 0) return NextResponse.json({ error: "No pending code-in-bio to check" }, { status: 404 });

  for (const p of pending) {
    if (await pageContains(p.profileUrl, p.code)) {
      await prisma.$transaction(async (tx) => {
        await tx.bioCode.update({ where: { id: p.id }, data: { status: "VERIFIED", verifiedAt: new Date() } });

        const prof = await tx.profile.findUnique({ where: { userId: session.user.id } });

        // merge into verifiedPlatforms JSON
        const merged = {
          ...((prof?.verifiedPlatforms as any) || {}),
          [p.platform]: { url: p.profileUrl, code: p.code, verifiedAt: new Date().toISOString() },
        };

        await tx.profile.update({
          where: { userId: session.user.id },
          data: {
            verifiedPlatforms: merged,
            platformVerifiedAt: new Date(),
            verificationStatus: prof?.verificationStatus === "DOMAIN_VERIFIED" ? "DOMAIN_VERIFIED" : "PLATFORM_VERIFIED",
          },
        });
      });

      const final = await prisma.profile.findUnique({ where: { userId: session.user.id }, select: { verificationStatus: true } });
      return NextResponse.json({ ok: true, profile: final });
    }
  }

  return NextResponse.json({ ok: false, message: "Marker not found yet" }, { status: 404 });
}
