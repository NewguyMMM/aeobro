// app/robots.txt/route.ts
import { getBaseUrl } from "@/lib/getBaseUrl";

export const revalidate = 3600;

export async function GET() {
  const base = getBaseUrl();
  const body = [
    "User-agent: *",
    "Allow: /",
    `Sitemap: ${base}/sitemap.xml`,
    "", // newline
  ].join("\n");

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=604800",
    },
  });
}
