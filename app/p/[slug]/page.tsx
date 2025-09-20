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
 * ISR: Cached at the edge; background re-render when stale.
 * Keep using tag-based revalidation from your API with revalidateTag(`profile:${slug}`).
 */
export const revalidate = 3600;

/* -------------------------------------------------------------------------- */
/*                              Cached DB readers                              */
/* -------------------------------------------------------------------------- */

// Narrow fetch for <head> metadata (fast)
const getProfileMetaCached = (slug: string) =>
  unstable_cache(
    async () => {
      return prisma.profile.findUnique({
        where: { slug },
        select: {
          displayName: true,
          tagline: true,
          logoUrl: true,
          slug: true,
        },
      });
    },
    ["profile:meta", slug],
    { revalidate, tags: [`profile:${slug}`] }
  )();

// Full fetch for the page body (render all human-visible fields)
const getProfileFullCached = (slug: string) =>
  unstable_cache(
    async () => {
      return prisma.profile.findUnique({
        where: { slug },
        // select explicitly (safe across schema tweaks)
        select: {
          id: true,
          slug: true,
          displayName: true,
          tagline: true,
          bio: true,
          logoUrl: true,
          image: true,
          avatarUrl: true,

          // Website, Location & Reach
          website: true,
          location: true,
          serviceArea: true,

          // Trust & Authority
          foundedYear: true,
          teamSize: true,
          pricingModel: true,
          languages: true,
          hours: true,
          certifications: true,

          // Arrays (stored as JSON in Prisma)
          links: true,        // [{label,url}] or string[]
          socialLinks: true,  // [{label?,url}] or string[]
          press: true,        // [{title,url}]
        },
      });
    },
    ["profile:full", slug],
    { revalidate, tags: [`profile:${slug}`] }
  )();

/* -------------------------------------------------------------------------- */
/*                                   SEO                                      */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/*                               Page component                                */
/* -------------------------------------------------------------------------- */

export default async function PublicProfilePage({ params }: PageProps) {
  const { slug } = params;
  const profile = await getProfileFullCached(slug);
  if (!profile) notFound();

  const baseUrl = await getRuntimeBaseUrl();
  const schema = buildProfileSchema(profile as any, baseUrl);

  // Human-readable fallbacks (robust to future schema tweaks)
  const displayName =
    (profile as any).displayName ??
    (profile as any).name ??
    (profile as any).organizationName ??
    slug;

  const headline =
    (profile as any).headline ??
    (profile as any).tagline ??
    "";

  const image: string | null =
    (profile as any).image ??
    (profile as any).avatarUrl ??
    (profile as any).logoUrl ??
    null;

  // Normalize link arrays → unique URLs
  const toUrl = (x: any) => (typeof x === "string" ? x : x?.url);
  const sameAs: string[] = Array.from(
    new Set(
      ([] as any[])
        .concat(Array.isArray((profile as any).links) ? (profile as any).links : [])
        .concat(Array.isArray((profile as any).socialLinks) ? (profile as any).socialLinks : [])
        .map(toUrl)
        .filter(Boolean)
    )
  );

  const press: Array<{ title?: string; url?: string }> = Array.isArray((profile as any).press)
    ? ((profile as any).press as any[])
    : [];

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

      {/* Bio / About — this is the missing piece from your screenshots */}
      {(profile as any).bio ? (
        <section className="prose max-w-none mb-10">
          <h2>About</h2>
          <p>{(profile as any).bio}</p>
        </section>
      ) : null}

      {/* Website, Location & Reach */}
      {(profile.website || profile.location || profile.serviceArea) && (
        <section className="mb-8">
          <h3 className="mb-2 text-lg font-medium">Website, Location &amp; Reach</h3>
          <ul className="space-y-1 text-sm">
            {profile.website && (
              <li>
                <span className="font-medium">Website:</span>{" "}
                <a className="underline" href={profile.website} rel="noopener noreferrer">
                  {profile.website}
                </a>
              </li>
            )}
            {profile.location && (
              <li>
                <span className="font-medium">Location:</span> {profile.location}
              </li>
            )}
            {profile.serviceArea && (
              <li>
                <span className="font-medium">Service area:</span> {profile.serviceArea}
              </li>
            )}
          </ul>
        </section>
      )}

      {/* Trust & Authority */}
      {(profile.foundedYear ||
        profile.teamSize ||
        profile.pricingModel ||
        profile.languages ||
        profile.hours ||
        profile.certifications) && (
        <section className="mb-8">
          <h3 className="mb-2 text-lg font-medium">Trust &amp; Authority</h3>
          <ul className="space-y-1 text-sm">
            {profile.foundedYear && (
              <li>
                <span className="font-medium">Founded:</span> {profile.foundedYear}
              </li>
            )}
            {profile.teamSize && (
              <li>
                <span className="font-medium">Team size:</span> {profile.teamSize}
              </li>
            )}
            {profile.pricingModel && (
              <li>
                <span className="font-medium">Pricing model:</span> {profile.pricingModel}
              </li>
            )}
            {profile.languages && (
              <li>
                <span className="font-medium">Languages:</span> {profile.languages}
              </li>
            )}
            {profile.hours && (
              <li>
                <span className="font-medium">Hours:</span> {profile.hours}
              </li>
            )}
            {profile.certifications && (
              <li>
                <span className="font-medium">Certifications:</span> {profile.certifications}
              </li>
            )}
          </ul>
        </section>
      )}

      {/* Links / Social */}
      {sameAs.length > 0 ? (
        <section className="mb-8">
          <h3 className="mb-2 text-lg font-medium">Links</h3>
          <ul className="list-disc space-y-1 pl-6">
            {sameAs.map((href, i) => (
              <li key={i}>
                <a className="underline" href={href} rel="noopener noreferrer">
                  {href}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Press & Directory Mentions */}
      {press.length > 0 ? (
        <section className="mb-10">
          <h3 className="mb-2 text-lg font-medium">Press &amp; Mentions</h3>
          <ul className="list-disc space-y-1 pl-6">
            {press.map((p, i) => (
              <li key={i}>
                <a className="underline" href={p.url} rel="noopener noreferrer">
                  {p.title || p.url}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Raw schema link for devs/bots */}
      <section className="mt-6">
        <a className="text-sm underline" href={`/api/profile/${encodeURIComponent(slug)}/schema`}>
          View raw schema JSON
        </a>
      </section>
    </main>
  );
}

/**
 * 🔁 How to purge one profile after edits
 * In your update API/route handler after persisting to Prisma:
 *   import { revalidateTag } from "next/cache";
 *   revalidateTag(`profile:${slug}`);
 *
 * This invalidates both the page body and metadata caches for that slug,
 * so the next request regenerates with fresh data.
 */
