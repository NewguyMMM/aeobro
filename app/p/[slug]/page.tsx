// app/p/[slug]/page.tsx
import { prisma } from "@/lib/prisma";
import {
  buildProfileSchema,
  buildFAQJsonLd,
  buildServiceJsonLd,
} from "@/lib/schema";
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
        select: {
          id: true,
          slug: true,
          displayName: true,
          tagline: true,
          bio: true,

          // Branding & media
          logoUrl: true,
          imageUrls: true, // string[]

          // Website, Location & Reach
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
          links: true, // [{label,url}] or string[]
          press: true, // [{title,url}]

          // Platform handles (object of URLs)
          handles: true,
        },
      });
    },
    ["profile:full", slug],
    { revalidate, tags: [`profile:${slug}`] }
  )();

// FAQs for this profile (public only)
const getFaqsCached = (profileId: string, slug: string) =>
  unstable_cache(
    async () => {
      return prisma.fAQItem.findMany({
        where: { profileId, isPublic: true },
        orderBy: { position: "asc" },
        select: { id: true, question: true, answer: true, position: true },
      });
    },
    ["profile:faqs", slug],
    { revalidate, tags: [`profile:${slug}`] }
  )();

// Services for this profile (public only)
const getServicesCached = (profileId: string, slug: string) =>
  unstable_cache(
    async () => {
      return prisma.serviceItem.findMany({
        where: { profileId, isPublic: true },
        orderBy: { position: "asc" },
        select: {
          id: true,
          name: true,
          description: true,
          url: true,
          priceMin: true,
          priceMax: true,
          priceUnit: true,
          currency: true,
          position: true,
        },
      });
    },
    ["profile:services", slug],
    { revalidate, tags: [`profile:${slug}`] }
  )();

/* -------------------------------------------------------------------------- */
/*                                Utilities                                    */
/* -------------------------------------------------------------------------- */

function safeUrl(u?: string | null): string | null {
  const s = typeof u === "string" ? u.trim() : "";
  return s ? s : null;
}
function pickFirst<T>(arr: (T | null | undefined)[]): T | null {
  for (const x of arr) if (x != null) return x as T;
  return null;
}

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
  const hero = safeUrl(profile.logoUrl);
  const images = hero ? [hero] : [];

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, images },
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

  // Fetch public Services and FAQ
  const [services, faqs] = await Promise.all([
    getServicesCached(profile.id, slug),
    getFaqsCached(profile.id, slug),
  ]);

  // JSON-LD blocks
  const schema = buildProfileSchema(profile as any, baseUrl);
  const faqJsonLd = buildFAQJsonLd(
    slug,
    faqs.map((f) => ({ question: f.question, answer: f.answer }))
  );
  const serviceJsonLd = buildServiceJsonLd(
    `${baseUrl}/p/${slug}#profile`,
    services.map((s) => ({
      name: s.name,
      description: s.description ?? undefined,
      url: s.url ?? undefined,
      priceMin: s.priceMin as any,
      priceMax: s.priceMax as any,
      priceUnit: s.priceUnit ?? undefined,
      currency: s.currency ?? undefined,
    }))
  );

  const displayName = profile.displayName ?? slug;
  const headline = profile.tagline ?? "";

  // Prefer a non-empty logo, else first non-empty image
  const image: string | null = pickFirst<string>([
    safeUrl(profile.logoUrl),
    ...(Array.isArray(profile.imageUrls)
      ? (profile.imageUrls.map((u) => safeUrl(u)).filter(Boolean) as string[])
      : []),
  ]);

  // Normalize links → unique, non-empty URLs
  const toUrl = (x: any) => safeUrl(typeof x === "string" ? x : x?.url);
  const linksArr = Array.isArray(profile.links) ? profile.links : [];
  const sameAs: string[] = Array.from(
    new Set(linksArr.map(toUrl).filter(Boolean) as string[])
  );

  // Platform handles → clickable, non-empty links
  const handles = (profile as any).handles || {};
  const handlePairs: Array<{ label: string; url: string }> = Object.entries(handles)
    .map(([k, v]) => ({ label: prettyHandleLabel(k), url: safeUrl(String(v)) }))
    .filter((h): h is { label: string; url: string } => !!h.url);

  // Press → filter empties and guarantee url is a string
  const press = Array.isArray(profile.press)
    ? (profile.press as any[])
        .map((p) => ({ title: p?.title as string | undefined, url: safeUrl(p?.url) }))
        .filter(
          (p): p is { title?: string; url: string } =>
            typeof p.url === "string" && p.url.length > 0
        )
    : [];

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      {/* MACHINE-READABLE JSON-LD */}
      <Script
        id="profile-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      {faqJsonLd ? (
        <Script
          id="faq-jsonld"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      ) : null}
      {serviceJsonLd.map((obj, i) => (
        <Script
          key={`service-jsonld-${i}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(obj) }}
        />
      ))}

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

      {/* Branding & Media: logo + small gallery */}
      {(safeUrl(profile.logoUrl) || (profile.imageUrls?.length ?? 0) > 1) && (
        <section className="mb-8">
          <h3 className="mb-2 text-lg font-medium">Branding &amp; Media</h3>
          <div className="flex flex-wrap gap-3">
            {safeUrl(profile.logoUrl) && (
              <div className="h-16 w-16 overflow-hidden rounded-md border">
                <OptimizedImg
                  src={safeUrl(profile.logoUrl)!}
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
              profile.imageUrls.slice(0, 6).map((raw, i) => {
                const src = safeUrl(raw);
                return src ? (
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
                ) : null;
              })}
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
      {(safeUrl(profile.website) || profile.location || (profile.serviceArea?.length ?? 0) > 0) && (
        <section className="mb-8">
          <h3 className="mb-2 text-lg font-medium">Website, Location &amp; Reach</h3>
          <ul className="space-y-1 text-sm">
            {safeUrl(profile.website) && (
              <li>
                <span className="font-medium">Website:</span>{" "}
                <a className="underline" href={safeUrl(profile.website)!} rel="noopener noreferrer">
                  {safeUrl(profile.website)}
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

      {/* Services */}
      {services.length > 0 && (
        <section id="services" className="mb-8">
          <h3 className="mb-2 text-lg font-medium">Services</h3>
          <ul className="grid gap-4 md:grid-cols-2">
            {services.map((s) => (
              <li key={s.id} className="rounded-xl border p-4">
                <div className="font-medium">{s.name}</div>
                {s.description ? (
                  <p className="text-sm text-gray-600 mt-1">{s.description}</p>
                ) : null}
                <div className="text-sm text-gray-700 mt-2">
                  {renderPrice(s.currency, s.priceMin as any, s.priceMax as any, s.priceUnit ?? undefined)}
                </div>
                {s.url ? (
                  <a href={s.url} className="inline-block mt-2 text-sky-600 hover:underline">
                    Learn more
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Platforms (handles) */}
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

      {/* FAQ */}
      {faqs.length > 0 && (
        <section id="faq" className="mb-10">
          <h3 className="mb-2 text-lg font-medium">FAQ</h3>
          <div className="divide-y rounded-xl border">
            {faqs.map((f) => (
              <details key={f.id} className="p-4">
                <summary className="cursor-pointer font-medium">{f.question}</summary>
                <div className="mt-2 text-gray-700 whitespace-pre-line">{f.answer}</div>
              </details>
            ))}
          </div>
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

function renderPrice(
  currency?: string | null,
  min?: number | string | null,
  max?: number | string | null,
  unit?: string
) {
  if (min == null && max == null) return null;
  const c = currency ? `${currency} ` : "";
  const m1 = min != null ? String(min) : "";
  const m2 = max != null ? String(max) : "";
  const range =
    min != null && max != null ? `${m1}–${m2}` : min != null ? m1 : `Up to ${m2}`;
  return (
    <span>
      {c}
      {range}
      {unit ? ` ${unit}` : ""}
    </span>
  );
}

/**
 * 🔁 Cache purge after edits
 * In your update API/route handler after saving:
 *   import { revalidateTag } from "next/cache";
 *   revalidateTag(`profile:${slug}`);
 */
