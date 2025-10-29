// app/api/verify/domain/recheck/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkDomainTxtForToken } from "@/lib/verification";

// Optional: protect with a secret so only Vercel cron can trigger it
function authorized(req: Request) {
  const hdr = req.headers.get("x-vercel-cron-secret");
  const expected = process.env.VERCEL_CRON_SECRET;
  return expected ? hdr === expected : true; // allow if no secret set
}

// Extract apex domain from a URL or raw string
function toApexDomain(input?: string | null): string | null {
  if (!input) return null;
  let raw = input.trim();
  if (!raw) return null;
  try {
    const u = new URL(raw.includes("://") ? raw : `https://${raw}`);
    raw = u.hostname;
  } catch {/* keep raw */}
  return raw.replace(/^www\./i, "").split("/")[0].trim() || null;
}

export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  // Recheck a bounded set of candidates to keep runtime short
  const candidates = await prisma.profile.findMany({
    where: {
      verificationStatus: "UNVERIFIED",
      verificationToken: { not: null },
      website: { not: null },
    },
    select: { id: true, website: true, verificationToken: true },
    take: 200,
    orderBy: { updatedAt: "desc" },
  });

  let checked = 0, verified = 0, skipped = 0;

  for (const p of candidates) {
    const domain = toApexDomain(p.website);
    if (!domain || !p.verificationToken) {
      skipped++;
      continue;
    }
    try {
      const ok = await checkDomainTxtForToken(domain, p.verificationToken);
      checked++;
      if (ok) {
        await prisma.profile.update({
          where: { id: p.id },
          data: { verificationStatus: "DOMAIN_VERIFIED", domainVerifiedAt: new Date() },
        });
        verified++;
      }
    } catch {
      // swallow to keep cron resilient
    }
  }

  return NextResponse.json({ ok: true, scanned: candidates.length, checked, verified, skipped });
}
