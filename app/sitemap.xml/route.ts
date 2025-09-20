// app/sitemap.xml/route.ts
import { prisma } from "@/lib/prisma";
import { getBaseUrl } from "@/lib/getBaseUrl";

/**
 * Sitemap (ISR, 1h). Crawlers hit cached XML from the edge.
 * Revalidate on profile saves for instant freshness.
 */
export const revalidate = 3600;        // 1 hour
export const runtime = "nodejs";       // Prisma needs Node runtime

function xml(strings: TemplateStringsArray, ...vals: any[]) {
  // minimal template tag to safely join
  return strings.reduce((out, s, i) => out + s + (vals[i] ?? ""), "");
}

export async function GET() {
  const base = getBaseUrl();

  // Pull public profile slugs. Adjust where/select to your schema.
  const profiles = await prisma.profile.findMany({
    select: { slug: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
    take: 5000, // sitemap soft limit per file
  });

  const urls = profiles
    .filter(p => p.slug)
    .map((p) => {
      const loc = `${base}/p/${encodeURIComponent(p.slug)}`;
      const lastmod = new Date(p.updatedAt ?? Date.now()).toISOString();
      return xml`<url><loc>${loc}</loc><lastmod>${lastmod}</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>`;
    })
    .join("");

  const body = xml`<?xml version="1.0" encoding="UTF-8"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url><loc>${base}</loc><changefreq>daily</changefreq><priority>1.0</priority></url>
    ${urls}
  </urlset>`;

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      // Cache hard at the edge; allow long SWR
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=604800",
    },
  });
}
