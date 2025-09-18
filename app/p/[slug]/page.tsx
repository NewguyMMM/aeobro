// app/p/[slug]/page.tsx
import { prisma } from "@/lib/prisma";
import { buildProfileSchema } from "@/lib/schema";
import { getBaseUrl } from "@/lib/getBaseUrl";
import Script from "next/script";
import Image from "next/image";
import { notFound } from "next/navigation";

type PageProps = { params: { slug: string } };

/**
 * Incremental Static Regeneration (ISR)
 * Cached at the edge; re-rendered in the background when stale.
 * Adjust to your traffic/cost needs (e.g., 300 = 5 min, 3600 = 1 hour).
 */
export const revalidate = 3600;

// (Optional) Keep this route statically renderable. Avoid reading cookies/session here.
// export const dynamic = "force-static";

export default async function PublicProfilePage({ params }: PageProps) {
  const { slug } = params;

  // Fetch by slug — ensure you have a unique index on Profile.slug
  const profile = await prisma.profile.findUnique({ where: { slug } });
  if (!profile) notFound();

  const baseUrl = getBaseUrl();
  const schema = buildProfileSchema(profile, baseUrl);

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

  const sameAs: string[] =
    Array.isArray((profile as any).links)
      ? (profile as any).links
      : Array.isArray((profile as any).socialLinks)
      ? (profile as any).socialLinks
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
            {/* Next/Image = automatic AVIF/WebP + CDN caching + DPR-aware sizing
               IMPORTANT: add the image host(s) to next.config.js > images.remotePatterns */}
            <Image
              src={image}
              alt={displayName}
              width={96}
              height={96}
              className="h-24 w-24 object-cover"
              priority
              sizes="96px"
            />
          </div>
        ) : null}

        <h1 className="text-3xl font-semibold">{displayName}</h1>
        {headline ? <p className="mt-2 text-muted-foreground">{headline}</p> : null}

        <p className="mt-4 text-sm text-gray-500">
          Canonical:{" "}
          <a className="underline" href={`${baseUrl}/p/${slug}`}>
            {baseUrl}/p/{slug}
          </a>
        </p>
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
