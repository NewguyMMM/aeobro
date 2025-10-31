// app/api/profile/[slug]/export/rss/route.ts
// ✅ Updated: 2025-10-31 08:36 ET – gated RSS skeleton

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isSyndicationAllowed } from "@/lib/verificationPolicy";
import { getBaseUrl } from "@/lib/getBaseUrl";

type Params = { params: { slug: string } };
export const revalidate = 3600;

export async function GET(_req: Request, { params }: Params) {
  const slug = params.slug;
  const profile = await prisma.profile.findFirst({
    where: { OR: [{ slug }, { id: slug }] },
    include: {
      user: { select: { plan: true, planStatus: true } },
      // Replace with your own "news" or "events" table when you have it
      serviceItems: { where: { isPublic: true }, orderBy: { updatedAt: "desc" }, take: 20 },
    },
  });

  if (!profile) {
    return NextResponse.json(
      { error: "Profile not found" },
      { status: 404, headers: { "X-Robots-Tag": "noindex" } }
    );
  }

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

  const base = getBaseUrl();
  const items = profile.serviceItems ?? [];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>${profile.displayName ?? profile.legalName ?? profile.slug}</title>
  <link>${base}/p/${profile.slug}</link>
  <description>Updates</description>
  ${items
    .map((s: any) => {
      const title = s.name ?? "Update";
      const link = s.url ?? `${base}/p/${profile.slug}#services`;
      const desc = (s.description ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
      const pub = new Date(s.updatedAt ?? profile.updatedAt).toUTCString();
      return `<item><title>${title}</title><link>${link}</link><description>${desc}</description><pubDate>${pub}</pubDate></item>`;
    })
    .join("")}
</channel>
</rss>`;

  return new NextResponse(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=604800",
    },
  });
}
