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

export const revalidate = 3600;

/* ----------------------------- Cached readers ----------------------------- */

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

const getProfileFullCached = (slug: string) =>
  unstable_cache(
    async () => {
      return prisma.profile.findUnique({
        where: { slug },
        select: {
          id: true,
          slug: true,
          displayName: true,
          tagline: true,
          bio: true,

          // Branding & media
          logoUrl: true,
          imageUrls: true, // string[]

          // Location & reach
          website: true,
          location: true,
          serviceArea: true, // string[]

          // Trust & Authority
          foundedYear: true,
          teamSize: true,
          pricingModel: true,
          languages: true, // string[]
          hours: true,
          certifications: true,

          // Links & press
          links: true,   // [{label,url}] or string[]
          press: true,   // [{title,url}]

          // Platform handles (object of URLs)
          handles: true,
        },
      });
    },
    ["profile:full", slug],
    { revalidate, tags: [`profile:${slug}`] }
  )();

/* --------------------------------- SEO ----------------------------------- */

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
  };
}

/* ----------------------------- Page component ---------------------------- */

export default async function PublicProfilePage({ params }: PageProps) {
  const { slug } = params;
  const profile = await getProfileFullCached(slug);
  if (!profile) notFound();

  const baseUrl = await getRuntimeBaseUrl();
  const schema = buildProfileSchema(profile as any, baseUrl);

  const displayName = profile.displayName ?? slug;
  const headline = profile.tagline ?? "";

  // Image: prefer logoUrl; else first imageUrls entry
  const image: string | null =
    profile.logoUrl ??
    (Array.isArray(profile.imageUrls) && profile.imageUrls.length > 0
      ? profile.imageUrls[0]
      : null);

  // Normalize links → unique URLs
  const toUrl = (x: any) => (typeof x === "string" ? x : x?.url);
  const linksArr = Array.isArray(profile.links) ? profile.links : [];
  const sameAs: string[] = Array.from(new Set(linksArr.map(toUrl).filter(Boolean)));

  // Platform handles → clickable links
  const handles = (profile as any).handles || {};
  const handlePairs: Array<{ label: string; url: string }> = Object.entries(handles)
    .filter(([, v]) => typeof v === "string" && v.trim() !== "")
    .map(([k, v]) => ({ label: prettyHandleLabel(k), url: String(v) }));

  const press: Array<{ title?: string; url?: string }> = Array.isArray(profile.press)
    ? (profile.press as any[])
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

      {/* Branding & Media: show gallery if additional images exist */}
      {(profile.logoUrl || (profile.imageUrls?.length ?? 0) > 1) && (
        <section className="mb-8">
          <h3 className="mb-2 text-lg font-medium">Branding &amp; Media</h3>
          <div className="flex flex-wrap gap-3">
            {profile.logoUrl && (
              <div className="h-16 w-16 overflow-hidden rounded-md border">
                <OptimizedImg
                  src={profile.logoUrl}
                  alt="Logo"
                  width={64}
                  height={64}
                  sizes="64px"
                  className="h-16 w-16 object-contain bg-white"
                  ratio={1}
                />
              </div>
            )}
            {Array.isArray(profile.imageUrls) &&
              profile.imageUrls.slice(0, 6).map((src, i) =>
                src ? (
                  <div key={i} className="h-16 w-16 overflow-hidden rounded-md border">
                    <OptimizedImg
                      src={src}
                      alt={`Image ${i + 1}`}
                      width={64}
                      height={64}
                      sizes="64px"
                      className="h-16 w-16 object-cover"
                      ratio={1}
                    />
                  </div>
                ) : null
              )}
          </div>
        </section>
      )}

      {/* Bio / About */}
      {profile.bio ? (
        <section className="prose max-w-none mb-10">
          <h2>About</h2>
          <p>{profile.bio}</p>
        </section>
      ) : null}

      {/* Website, Location & Reach */}
      {(profile.website || profile.location || (profile.serviceArea?.length ?? 0) > 0) && (
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
            {(profile.serviceArea?.length ?? 0) > 0 && (
              <li>
                <span className="font-medium">Service area:</span>{" "}
                {profile.serviceArea!.join(", ")}
              </li>
            )}
          </ul>
        </section>
      )}

      {/* Trust & Authority */}
      {(profile.foundedYear ||
        profile.teamSize ||
        profile.pricingModel ||
        (profile.languages?.length ?? 0) > 0 ||
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
            {(profile.languages?.length ?? 0) > 0 && (
              <li>
                <span className="font-medium">Languages:</span>{" "}
                {profile.languages!.join(", ")}
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

      {/* Platform Handles */}
      {handlePairs.length > 0 && (
        <section className="mb-8">
          <h3 className="mb-2 text-lg font-medium">Platforms</h3>
          <ul className="list-disc space-y-1 pl-6">
            {handlePairs.map((h, i) => (
              <li key={i}>
                <a className="underline" href={h.url} rel="noopener noreferrer">
                  {h.label}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Links */}
      {sameAs.length > 0 && (
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
      )}

      {/* Press & Mentions */}
      {press.length > 0 && (
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
      )}

      {/* Raw schema link */}
      <section className="mt-6">
        <a className="text-sm underline" href={`/api/profile/${encodeURIComponent(slug)}/schema`}>
          View raw schema JSON
        </a>
      </section>
    </main>
  );
}

/* ------------------------------ helpers ---------------------------------- */

function prettyHandleLabel(key: string) {
  const map: Record<string, string> = {
    youtube: "YouTube",
    tiktok: "TikTok",
    instagram: "Instagram",
    substack: "Substack",
    etsy: "Etsy",
    x: "X (Twitter)",
    linkedin: "LinkedIn",
    facebook: "Facebook",
    github: "GitHub",
  };
  return map[key] || key;
}

/**
 * 🔁 Cache purge after edits
 * In your update API/route handler after saving:
 *   import { revalidateTag } from "next/cache";
 *   revalidateTag(`profile:${slug}`);
 */
