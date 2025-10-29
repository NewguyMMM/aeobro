// app/p/[slug]/page.tsx
// Updated: 2025-10-29 09:56 ET – add <link rel="alternate" type="application/ld+json"> via Metadata API

import { prisma } from "@/lib/prisma";
import {
  buildProfileSchema,
  buildFAQJsonLd,
  buildServiceJsonLd,
} from "@/lib/schema";
import { getRuntimeBaseUrl } from "@/lib/getBaseUrl";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import OptimizedImg from "@/components/OptimizedImg";
import { unstable_cache } from "next/cache";
import SchemaPreviewButton from "@/components/SchemaPreviewButton";

type PageProps = { params: { slug: string } };

export const runtime = "nodejs";
export const revalidate = 3600;

/* --------------------- Cached DB readers (schema-safe) -------------------- */

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
      // NOTE: no select → includes verificationStatus and other fields needed for badge & JSON-LD
      return prisma.profile.findUnique({
        where: { slug },
      });
    },
    ["profile:full", slug],
    { revalidate, tags: [`profile:${slug}`] }
  )();

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

/* -------------------------------- Utils ---------------------------------- */

function safeUrl(u?: string | null): string | null {
  const raw = typeof u === "string" ? u.trim() : "";
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol === "http:" || url.protocol === "https:") return url.toString();
    return null;
  } catch {
    return null;
  }
}
function pickFirst<T>(arr: (T | null | undefined)[]): T | null {
  for (const x of arr) if (x != null) return x as T;
  return null;
}

/** Canonicalize a platform handle or url to an https URL (mirrors lib/schema.ts) */
function handleToCanonicalUrl(key: string, raw: any): string | null {
  // If full URL already:
  const asUrl = safeUrl(typeof raw === "string" ? raw : (raw as any)?.url);
  if (asUrl) return asUrl;

  const vRaw = typeof raw === "string" ? raw : (raw as any)?.handle ?? "";
  const v = String(vRaw).trim();
  if (!v) return null;
  const noAt = v.replace(/^@/, "");
  if (/\s|["'<>\u0000]/.test(noAt)) return null;

  const k = (key || "").toLowerCase();
  switch (k) {
    case "youtube":
      return `https://www.youtube.com/@${noAt}`;
    case "tiktok":
      return `https://www.tiktok.com/@${noAt}`;
    case "instagram":
      return `https://www.instagram.com/${noAt}`;
    case "x":
    case "twitter":
      return `https://twitter.com/${noAt}`;
    case "linkedin":
      return `https://www.linkedin.com/in/${noAt}`;
    case "facebook":
      return `https://www.facebook.com/${noAt}`;
    case "github":
      return `https://github.com/${noAt}`;
    case "substack":
      return `https://${noAt}.substack.com/`;
    case "etsy":
      return `https://www.etsy.com/shop/${noAt}`;
    default:
      return null;
  }
}

function ErrorBlock({
  title,
  err,
  hint,
}: {
  title: string;
  err: unknown;
  hint?: string;
}) {
  const msg =
    (err as any)?.message ||
    (err as any)?.toString?.() ||
    JSON.stringify(err, null, 2);
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-xl font-semibold text-red-600">{title}</h1>
      {hint ? <p className="mt-2 text-sm text-gray-700">{hint}</p> : null}
      <pre className="whitespace-pre-wrap text-xs bg-gray-100 p-4 rounded-md mt-4">
        {msg}
      </pre>
    </main>
  );
}

/** Escape `<` so `</script>` can’t prematurely close the tag */
function escapeForJsonLd(obj: unknown) {
  return JSON.stringify(obj).replace(/</g, "\\u003c");
}

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
  const hero = safeUrl(profile.logoUrl);
  const images = hero ? [hero] : [];

  return {
    title,
    description,
    alternates: {
      canonical: url,
      // ✅ This injects: <link rel="alternate" type="application/ld+json" href="/api/profile/[slug]/schema">
      types: {
        "application/ld+json": `${baseUrl}/api/profile/${params.slug}/schema`,
      },
    },
    openGraph: { title, description, url, images },
  };
}

/* ------------------------------ Page ------------------------------------- */

export default async function PublicProfilePage({ params }: PageProps) {
  const { slug } = params;

  let profile: any;
  try {
    profile = await getProfileFullCached(slug);
  } catch (err: any) {
    console.error("[/p/[slug]] PROFILE FETCH ERROR", {
      slug,
      errName: err?.name,
      errCode: err?.code,
      message: err?.message,
    });
    return (
      <ErrorBlock
        title="Database Error while loading profile"
        err={err}
        hint="If this persists, check Neon connectivity and Prisma datasource URL."
      />
    );
  }

  if (!profile) {
    console.warn("[/p/[slug]] PROFILE NOT FOUND", { slug });
    notFound();
  }

  try {
    console.log("[/p/[slug]] PROFILE OK", { slug, profileId: profile.id });
  } catch {}

  const baseUrl = await getRuntimeBaseUrl();

  const [servicesRes, faqsRes] = await Promise.allSettled([
    getServicesCached(profile.id, slug),
    getFaqsCached(profile.id, slug),
  ]);

  if (servicesRes.status === "rejected") {
    const reason: any = servicesRes.reason;
    console.error("[/p/[slug]] SERVICES FETCH ERROR", {
      slug,
      profileId: profile.id,
      errName: reason?.name,
      errCode: reason?.code,
      message: reason?.message,
    });
    return (
      <ErrorBlock
        title="Database Error while loading services"
        err={reason}
        hint="Verify prisma schema & migrations for ServiceItem, and DB availability."
      />
    );
  }
  if (faqsRes.status === "rejected") {
    const reason: any = faqsRes.reason;
    console.error("[/p/[slug]] FAQ FETCH ERROR", {
      slug,
      profileId: profile.id,
      errName: reason?.name,
      errCode: reason?.code,
      message: reason?.message,
    });
    return (
      <ErrorBlock
        title="Database Error while loading FAQs"
        err={reason}
        hint="Verify prisma schema & migrations for FAQItem."
      />
    );
  }

  const services = servicesRes.value;
  const faqs = faqsRes.value;

  // 3) Build JSON-LD
  let schema: any, faqJsonLd: any, serviceJsonLd: any[];
  try {
    schema = buildProfileSchema(profile, baseUrl);
    faqJsonLd = buildFAQJsonLd(
      slug,
      faqs.map((f) => ({ question: f.question, answer: f.answer }))
    );
    serviceJsonLd = buildServiceJsonLd(
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
  } catch (err: any) {
    console.error("[/p/[slug]] JSON-LD BUILD ERROR", {
      slug,
      profileId: profile.id,
      errName: err?.name,
      message: err?.message,
    });
    return (
      <ErrorBlock
        title="Template Error while building JSON-LD"
        err={err}
        hint="Check buildProfileSchema/buildFAQJsonLd/buildServiceJsonLd inputs."
      />
    );
  }

  const displayName = profile.displayName ?? slug;
  const headline = profile.tagline ?? "";

  const image: string | null = pickFirst<string>([
    safeUrl(profile.logoUrl),
    ...(Array.isArray(profile.imageUrls)
      ? (profile.imageUrls.map((u: any) => safeUrl(u)).filter(Boolean) as string[])
      : []),
  ]);

  // ======== Links (visible on page) should mirror JSON-LD sameAs ========
  const sameAsSet = new Set<string>();

  const websiteUrl = safeUrl(profile.website);
  if (websiteUrl) sameAsSet.add(websiteUrl);

  const linksArr = Array.isArray(profile.links) ? profile.links : [];
  linksArr.forEach((x: any) => {
    const u = typeof x === "string" ? safeUrl(x) : safeUrl(x?.url);
    if (u) sameAsSet.add(u);
  });

  const socialsArr = Array.isArray(profile.socialLinks) ? profile.socialLinks : [];
  socialsArr.forEach((x: any) => {
    const u = typeof x === "string" ? safeUrl(x) : safeUrl(x?.url);
    if (u) sameAsSet.add(u);
  });

  const handlesObj = profile?.handles || {};
  if (handlesObj && typeof handlesObj === "object") {
    for (const [k, v] of Object.entries(handlesObj)) {
      const canon = handleToCanonicalUrl(k, v);
      if (canon) sameAsSet.add(canon);
    }
  }

  const sameAs: string[] = Array.from(sameAsSet);

  // Handles for the “Platforms” section (anchors keep human-friendly labels)
  const handlePairs: Array<{ label: string; url: string }> =
    Object.entries(profile?.handles || {})
      .map(([k, v]) => {
        const url = handleToCanonicalUrl(k, v);
        return url ? { label: prettyHandleLabel(k), url } : null;
      })
      .filter(Boolean) as Array<{ label: string; url: string }>;

  // Press
  const press: Array<{ title?: string; url: string }> = Array.isArray(profile.press)
    ? (profile.press as any[]).reduce<Array<{ title?: string; url: string }>>(
        (acc, p) => {
          const url = safeUrl(p?.url);
          if (url) acc.push({ title: p?.title ?? undefined, url });
          return acc;
        },
        []
      )
    : [];

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      {/* JSON-LD (server-rendered, no JS execution required) */}
      {schema ? (
        <script
          id="profile-jsonld"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: escapeForJsonLd(schema) }}
        />
      ) : null}
      {faqJsonLd ? (
        <script
          id="faq-jsonld"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: escapeForJsonLd(faqJsonLd) }}
        />
      ) : null}
      {serviceJsonLd.map((obj, i) => (
        <script
          key={`service-jsonld-${i}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: escapeForJsonLd(obj) }}
        />
      ))}

      {/* Header */}
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

        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-semibold">{displayName}</h1>
          {/* ✅ Verified badge (hidden when UNVERIFIED) */}
          <Verified status={profile?.verificationStatus} />
        </div>

        {headline ? <p className="mt-2 text-muted-foreground">{headline}</p> : null}
      </header>

      {/* Branding & Media */}
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
              profile.imageUrls.slice(0, 6).map((raw: any, i: number) => {
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

      {/* About */}
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
                  {renderPrice(
                    s.currency,
                    s.priceMin as any,
                    s.priceMax as any,
                    s.priceUnit ?? undefined
                  )}
                </div>
                {s.url ? (
                  <a href={s.url} className="inline-block mt-2 text-sky-600 hover:underline" rel="noopener noreferrer">
                    Learn more
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Platforms */}
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

      {/* Press */}
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

      {/* Preview & raw schema */}
      <section className="mt-6 flex items-center gap-3">
        <SchemaPreviewButton slug={slug} includeAll={true} pretty={true} />
        <a
          className="text-sm underline"
          href={`/api/profile/${encodeURIComponent(slug)}/schema`}
          rel="noopener noreferrer"
        >
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
    twitter: "Twitter",
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

/** Simple inline verified badge (kept here to avoid adding new files) */
function Verified({ status }: { status?: string | null }) {
  if (!status || status === "UNVERIFIED") return null;
  const label = status === "DOMAIN_VERIFIED" ? "Verified (Domain)" : "Verified";
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs bg-emerald-600 text-white">
      <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
        <path d="M9 16.2 5.5 12.7l1.4-1.4L9 13.4 16.1 6.3l1.4 1.4z" fill="currentColor" />
      </svg>
      {label}
    </span>
  );
}

/**
 * After edits that change a profile, call:
 *   import { revalidateTag } from "next/cache";
 *   revalidateTag(`profile:${slug}`);
 */
