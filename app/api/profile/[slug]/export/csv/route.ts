// app/api/profile/[slug]/export/csv/route.ts
// ✅ Updated: 2025-10-31 08:36 ET – gated CSV export (Services-only example)

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isSyndicationAllowed } from "@/lib/verificationPolicy";

type Params = { params: { slug: string } };
export const revalidate = 3600;

function toCsv(rows: Array<Record<string, any>>) {
  if (!rows.length) return "name,description,url,priceMin,priceMax,priceUnit,currency\n";
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(","),
    ...rows.map((r) =>
      headers
        .map((h) => {
          const v = r[h];
          const s = v == null ? "" : String(v);
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(",")
    ),
  ];
  return lines.join("\n");
}

export async function GET(_req: Request, { params }: Params) {
  const slug = params.slug;

  const profile = await prisma.profile.findFirst({
    where: { OR: [{ slug }, { id: slug }] },
    include: {
      user: { select: { plan: true, planStatus: true } },
      serviceItems: {
        where: { isPublic: true },
        orderBy: { position: "asc" },
        select: {
          name: true, description: true, url: true,
          priceMin: true, priceMax: true, priceUnit: true, currency: true,
        },
      },
    },
  });

  if (!profile) {
    return NextResponse.json(
      { error: "Profile not found" },
      { status: 404, headers: { "X-Robots-Tag": "noindex" } }
    );
  }

  // 🔒 Gate public export
  const allowed = isSyndicationAllowed(profile, { enforcePlan: true });
  if (!allowed) {
    return NextResponse.json(
      {
        error:
          "Syndication disabled. Verify your domain or connect a platform (or activate an eligible plan).",
        verificationStatus: profile.verificationStatus,
      },
      {
        status: 403,
        headers: {
          "X-Robots-Tag": "noindex, nofollow",
          "Cache-Control": "public, s-maxage=300, max-age=120",
        },
      }
    );
  }

  const csv = toCsv(profile.serviceItems as any[]);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${profile.slug}-services.csv"`,
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=604800",
    },
  });
}
