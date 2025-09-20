// app/p/[slug]/page.tsx
import { prisma } from "@/lib/prisma";
import { buildProfileSchema } from "@/lib/schema";
import { getRuntimeBaseUrl } from "@/lib/getBaseUrl";
import Script from "next/script";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import OptimizedImg from "@/components/OptimizedImg";
import { unstable_cache } from "next/cache";

type PageProps = { params: { slug: string } };

/**
 * Incremental Static Regeneration (ISR)
 * Cached at the edge; re-rendered in the background when stale.
 * Adjust to your traffic/cost needs (e.g., 300 = 5 min, 3600 = 1 hour).
 */
export const revalidate = 3600;

// ---- Cached readers (tag-based) ---------------------------------------------

// Narrow read for <head> metadata (fast)
const getProfileMetaCached = (slug: string) =>
  unstable_cache(
    async () => {
      return prisma.profile.findUnique({
        where: { slug },
        select: { displayName: true, tagline: true, logoUrl: true, slug: true },
      });
    },
    // cache key (unique per slug)
    ["profile:meta", slug],
    { revalidate, tags: [`profile:${slug}`] }
  )();

// Full read for the page body
const getProfileFullCached = (slug: string) =>
  unstable_cache(
    async () => {
      return prisma.profile.findUnique({ where: { slug } });
    },
    ["profile:full", slug],
    { revalidate, tags: [`profile:${slug}`] }
  )();

// -----------------------------------------------------------------------------
// SEO metadata (canonical, OG, Twitter)
export async function generateMetadata(
  { params }: { params: { slug: string } }
): Promise<Metadata> {
  const profile = await getProfileMetaCached(params.slug);
  if (!profile) return { title: "Profile not found" };

  const baseUrl = await getRuntimeBaseUrl();
  const url = `${baseUrl}/p/${params.slug}`;
  const title = profile.displayName ?? "Profile";
  const description = profile.tagline ?? "Public profile";
  const images = profile.logoUrl ? [profile.logoUrl] : [];

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, images },
    twitter: { card: "summary_large_image", title, description, images },
  };
}

export default async function PublicProfilePage({ params }: PageProps) {
  const { slug } = params;

  // Cached DB read (ISR + tag)
  const profile = await getProfileFullCached(slug);
  if (!profile) notFound();

  const baseUrl = await getRuntimeBaseUrl();
  const schema = buildProfileSchema(profile as any, baseUrl);

  // Human-readable fallbacks (keep simple and robust)
  const displayName =
    (profile as any).displayName ??
    (profile as any).name ??
    (profile as any).organizationName ??
    slug;

  const headline =
    (profile as any).headline ??
    (profile as any).tagline ??
    (profile as any).bio ??
    "";

  const image: string | null =
    (profile as any).image ??
    (profile as any).avatarUrl ??
    (profile as any).logoUrl ??
    null;

  // Links: accept either array of strings or array of objects with {url}
  const toUrl = (x: any) => (typeof x === "string" ? x : x?.url);
  const sameAs: string[] = Array.from(
    new Set(
      (Array.isArray((profile as any).links) ? (profile as any).links : [])
        .concat(Array.isArray((profile as any).socialLinks) ? (profile as any).socialLinks : [])
        .map(toUrl)
        .filter(Boolean)
    )
  );

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      {/* MACHINE-READABLE JSON-LD */}
      <Script
        id="profile-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />

      {/* HUMAN-READABLE PROFILE */}
      <header className="mb-8">
        {image ? (
          <div className="mb-4 h-24 w-24 overflow-hidden rounded-2xl">
            {/* next/image via our wrapper: AVIF/WebP + CDN caching + DPR-aware sizing */}
            <OptimizedImg
              src={image}
              alt={`${displayName} logo`}
              width={96}
              height={96}
              priority
              sizes="96px"
              className="h-24 w-24 object-cover"
              ratio={1}
            />
          </div>
        ) : null}

        <h1 className="text-3xl font-semibold">{displayName}</h1>
        {headline ? <p className="mt-2 text-muted-foreground">{headline}</p> : null}
      </header>

      {/* Social / Links */}
      {sameAs.length > 0 ? (
        <section className="mt-6">
          <h2 className="mb-3 text-lg font-medium">Links</h2>
          <ul className="list-disc space-y-1 pl-6">
            {sameAs.map((href, i) => (
              <li key={i}>
                <a className="underline" href={href}>
                  {href}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Optional: Raw schema link for devs/bots */}
      <section className="mt-10">
        <a
          className="text-sm underline"
          href={`/api/profile/${encodeURIComponent(slug)}/schema`}
        >
          View raw schema JSON
        </a>
      </section>
    </main>
  );
}

/**
 * 🔁 How to purge one profile after edits
 * Call this in your update API/route action after writing to the DB:
 *   import { revalidateTag } from "next/cache";
 *   revalidateTag(`profile:${slug}`); // or use profile ID if you prefer
 *
 * This invalidates both the page body and metadata caches for that slug,
 * so the next request regenerates with fresh data.
 */
