// app/p/[slug]/page.tsx
// 📅 Updated: 2026-02-18 02:41 PM ET
// Fix: build failure by removing non-existent Prisma select keys for AI agent fields.
// Adds: AI_AGENT public rendering (Phase 1 / Option E scope - Step 4)
// Keeps: 2-tier publish gating (LITE vs PLUS) + planStatus enforcement (inactive/missing => LITE)
// Keeps: visibility guard (PUBLIC only). UNPUBLISHED/DELETED => notFound() => no longer crawlable.
// Keeps: Schema tools eligibility logic unchanged.

import { prisma } from "@/lib/prisma";
import { buildProfileSchema, buildFAQJsonLd, buildServiceJsonLd } from "@/lib/schema";
import { getRuntimeBaseUrl } from "@/lib/getBaseUrl";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import OptimizedImg from "@/components/OptimizedImg";
import { unstable_cache } from "next/cache";
import SchemaPreviewButton from "@/components/SchemaPreviewButton";

type PageProps = { params: { slug: string } };

export const runtime = "nodejs";
export const revalidate = 3600;

/* -------------------------------------------------------------------------- */
/*                           Cached DB readers                                */
/* -------------------------------------------------------------------------- */

const getProfileMetaCached = (slug: string) =>
  unstable_cache(
    async () => {
      const profile = await prisma.profile.findUnique({
        where: { slug },
        select: {
          displayName: true,
          tagline: true,
          visibility: true,
        },
      });

      // If not found or not public, treat as not found (unpublished/deleted)
      if (!profile) return null;
      if (profile.visibility !== "PUBLIC") return null;

      return {
        displayName: profile.displayName ?? "Profile",
        tagline: profile.tagline ?? null,
      };
    },
    ["profile-meta", slug],
    { revalidate: 3600 }
  );

const getProfileFullCached = (slug: string) =>
  unstable_cache(
    async () => {
      const profile = await prisma.profile.findUnique({
        where: { slug },
        select: {
          id: true,
          slug: true,
          visibility: true, // NEW
          displayName: true,
          legalName: true,
          entityType: true,
          tagline: true,
          bio: true,
          website: true,
          location: true,
          serviceArea: true,
          foundedYear: true,
          teamSize: true,
          languages: true,
          pricingModel: true,
          hours: true,
          certifications: true,
          press: true,
          logoUrl: true,
          imageUrls: true,
          handles: true,
          links: true,
          verificationStatus: true,
          updateMessage: true,
          updatedAt: true,
          faqJson: true,
          servicesJson: true,

          // ❗ IMPORTANT:
          // Do NOT select AI agent fields here.
          // Your current generated Prisma Client types do not include them,
          // which causes TS compile errors in Vercel build.
          // We will read them from (profile as any) at runtime if they exist.

          user: {
            select: {
              plan: true,
              planStatus: true, // ✅ required for fail-closed gating
            },
          },
          platformAccounts: {
            where: { status: "VERIFIED" },
            orderBy: { createdAt: "desc" },
            select: { id: true, provider: true, url: true, handle: true },
          },
        },
      });

      return profile;
    },
    ["profile-full", slug],
    { revalidate: 3600 }
  );

/* -------------------------------------------------------------------------- */
/*                             Metadata (SEO)                                 */
/* -------------------------------------------------------------------------- */

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const slug = decodeURIComponent(params.slug);
  const meta = await getProfileMetaCached(slug)();

  if (!meta) {
    return {
      title: "Profile not found | AEOBRO",
      description: "This profile could not be found.",
    };
  }

  const baseUrl = await getRuntimeBaseUrl();
  const url = `${baseUrl}/p/${slug}`;
  const title = `${meta.displayName} | AEOBRO`;
  const description =
    meta.tagline ??
    "Verified profile powered by AEOBRO to help AI systems understand this brand.";

  return {
    title,
    description,
    alternates: {
      canonical: url,
      types: {
        "application/ld+json": `${baseUrl}/api/profile/${slug}/schema`,
      },
    },
    openGraph: {
      title,
      description,
      url,
    },
  };
}

/* -------------------------------------------------------------------------- */
/*                                Page render                                 */
/* -------------------------------------------------------------------------- */

function plusPublishingAllowedFrom(planRaw: unknown, planStatusRaw: unknown): boolean {
  // Fail-closed: missing planStatus => not active
  const status = String(planStatusRaw ?? "").toLowerCase();
  if (status !== "active") return false;

  const plan = String(planRaw ?? "LITE").toLowerCase();

  // plan stored as labels in this file ("Plus", "Pro", etc) — keep your current convention
  return plan === "plus" || plan === "pro" || plan === "business" || plan === "enterprise";
}

function isAiAgentEntity(entityTypeRaw: unknown): boolean {
  const v = String(entityTypeRaw ?? "").trim().toLowerCase();
  return v === "ai_agent" || v === "ai agent" || v === "ai-agent";
}

function asStringOrNull(v: any): string | null {
  const s = (v ?? "").toString().trim();
  return s ? s : null;
}

function asStringArray(v: any): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x).trim()).filter(Boolean);
}

export default async function Page({ params }: PageProps) {
  const slug = decodeURIComponent(params.slug);
  const profile = await getProfileFullCached(slug)();

  if (!profile) {
    notFound();
  }

  // NEW: visibility guard (PUBLIC only)
  if (profile.visibility !== "PUBLIC") {
    notFound();
  }

  const baseUrl = await getRuntimeBaseUrl();

  const displayName = profile.displayName ?? slug;
  const tagline = profile.tagline ?? null;
  const bio = profile.bio ?? null;
  const website = profile.website ?? null;
  const location = profile.location ?? null;
  const serviceArea = Array.isArray(profile.serviceArea)
    ? (profile.serviceArea as string[])
    : [];

  const logoUrl = profile.logoUrl ?? null;
  const imageUrls = Array.isArray(profile.imageUrls)
    ? (profile.imageUrls as string[])
    : [];

  const verificationStatus = profile.verificationStatus ?? "UNVERIFIED";
  const plan = (profile.user?.plan as string | null) ?? "Free";
  const planStatus = (profile.user as any)?.planStatus as string | null;

  // ✅ 2-tier public render/publish gating
  const plusPublishingAllowed = plusPublishingAllowedFrom(plan, planStatus);

  const updateMessage =
    plusPublishingAllowed
      ? ((profile.updateMessage && profile.updateMessage.trim()) || null)
      : null;

  const updatedDate =
    plusPublishingAllowed && updateMessage
      ? profile.updatedAt instanceof Date
        ? profile.updatedAt.toISOString().slice(0, 10)
        : null
      : null;

  const isDomainVerified = verificationStatus === "DOMAIN_VERIFIED";
  const hasPlatformVerified =
    verificationStatus === "PLATFORM_VERIFIED" ||
    ((profile.platformAccounts?.length ?? 0) > 0);

  const verificationLabel =
    isDomainVerified && hasPlatformVerified
      ? "Domain & Platform Verified"
      : isDomainVerified
      ? "Domain Verified"
      : hasPlatformVerified
      ? "Platform Verified"
      : null;

  // FAQ & Services JSON from profile (✅ gated)
  const faqJson =
    plusPublishingAllowed && Array.isArray(profile.faqJson)
      ? (profile.faqJson as Array<{ question: string; answer: string }>)
      : [];

  const servicesJson =
    plusPublishingAllowed && Array.isArray(profile.servicesJson)
      ? (profile.servicesJson as Array<{
          name: string;
          description?: string | null;
          url?: string | null;
          priceMin?: string | null;
          priceMax?: string | null;
          priceUnit?: string | null;
          currency?: string | null;
        }>)
      : [];

  // Handles, links, press
  const handles = (profile.handles || {}) as Record<string, any>;
  const rawHandleEntries = Object.entries(handles);
  const handleEntries = rawHandleEntries
    .map(([key, raw]) => {
      const value = String(
        typeof raw === "string" ? raw : (raw as any)?.handle ?? ""
      ).trim();
      if (!value) return null;
      return { key, value };
    })
    .filter(Boolean) as { key: string; value: string }[];

  const linksArr = Array.isArray(profile.links)
    ? (profile.links as Array<{ label?: string | null; url?: string | null }>)
    : [];
  const pressArr = Array.isArray(profile.press)
    ? (profile.press as Array<{ title?: string | null; url?: string | null }>)
    : [];

  // Schema tools gating (UNCHANGED)
  const paidPlans = ["Plus", "Pro", "Business", "Enterprise"];
  const isPaidPlan = plan && paidPlans.includes(plan);
  const canUseSchemaTools =
    verificationStatus === "DOMAIN_VERIFIED" ||
    verificationStatus === "PLATFORM_VERIFIED" ||
    isPaidPlan;

  const hasBrandingContent = !!bio || imageUrls.length > 0;

  // AI_AGENT view model (not gated) — read from runtime object if present
  const isAiAgent = isAiAgentEntity(profile.entityType);

  const pAny = profile as any;
  const aiProvider = asStringOrNull(pAny.aiAgentProvider);
  const aiModel = asStringOrNull(pAny.aiAgentModel);
  const aiVersion = asStringOrNull(pAny.aiAgentVersion);
  const aiDocsUrl = asStringOrNull(pAny.aiAgentDocsUrl);
  const aiApiUrl = asStringOrNull(pAny.aiAgentApiUrl);

  const aiCapabilities = asStringArray(pAny.aiAgentCapabilities);
  const aiInputModes = asStringArray(pAny.aiAgentInputModes);
  const aiOutputModes = asStringArray(pAny.aiAgentOutputModes);

  const hasAiAgentDetails =
    isAiAgent &&
    (!!aiProvider ||
      !!aiModel ||
      !!aiVersion ||
      !!aiDocsUrl ||
      !!aiApiUrl ||
      aiCapabilities.length > 0 ||
      aiInputModes.length > 0 ||
      aiOutputModes.length > 0);

  /* ---------------------------- Build JSON-LD ---------------------------- */

  let jsonLdPayload: any[] = [];

  try {
    // ✅ IMPORTANT: pass null to force-suppress updateMessage for LITE/inactive
    const main = buildProfileSchema(
      profile as any,
      baseUrl,
      plusPublishingAllowed ? updateMessage : null
    );

    const faq =
      faqJson.length > 0
        ? buildFAQJsonLd(
            slug,
            faqJson.map((f) => ({
              question: f.question,
              answer: f.answer,
            }))
          )
        : null;

    const services =
      servicesJson.length > 0
        ? buildServiceJsonLd(
            `${baseUrl}/p/${slug}#profile`,
            servicesJson.map((s) => ({
              name: s.name,
              description: s.description ?? undefined,
              url: s.url ?? undefined,
              priceMin: s.priceMin ?? undefined,
              priceMax: s.priceMax ?? undefined,
              priceUnit: s.priceUnit ?? undefined,
              currency: s.currency ?? undefined,
            }))
          )
        : null;

    const parts: any[] = [];
    if (main) parts.push(main);
    if (faq) parts.push(faq);
    if (services && Array.isArray(services)) {
      parts.push(...services);
    }

    jsonLdPayload = parts;
  } catch (err) {
    console.error("Error building JSON-LD for profile:", slug, err);
    jsonLdPayload = [];
  }

  return (
    <>
      <main className="mx-auto max-w-3xl px-4 py-8 space-y-8">
        {/* Header / Identity */}
        <header className="flex flex-col gap-4 border-b pb-6">
          <div className="flex items-start gap-4">
            {logoUrl && (
              <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl border bg-white">
                <OptimizedImg
                  src={logoUrl}
                  alt={`${displayName} logo`}
                  className="h-full w-full object-contain"
                  width={64}
                  height={64}
                />
              </div>
            )}
            <div className="flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold">{displayName}</h1>
                {isAiAgent && (
                  <span className="inline-flex items-center rounded-full bg-purple-50 px-3 py-1 text-xs font-medium text-purple-700 border border-purple-200">
                    AI Agent
                  </span>
                )}
                {verificationLabel && (
                  <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 border border-blue-200">
                    {verificationLabel}
                  </span>
                )}
              </div>
              {tagline && (
                <p className="text-sm text-gray-700 leading-snug">{tagline}</p>
              )}
            </div>
          </div>

          {/* AI Agent Details (not gated) */}
          {hasAiAgentDetails && (
            <section className="mt-2 rounded-2xl border border-purple-200 bg-purple-50 px-4 py-3 text-sm text-purple-900">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide">
                  AI agent identity
                </span>
                <span className="text-[11px] text-purple-800/80">
                  Machine-readable via JSON-LD
                </span>
              </div>

              <ul className="mt-2 space-y-1 text-sm">
                {aiProvider && (
                  <li>
                    <span className="font-medium">Provider:</span> {aiProvider}
                  </li>
                )}
                {aiModel && (
                  <li>
                    <span className="font-medium">Model:</span> {aiModel}
                  </li>
                )}
                {aiVersion && (
                  <li>
                    <span className="font-medium">Version:</span> {aiVersion}
                  </li>
                )}
                {aiDocsUrl && (
                  <li>
                    <span className="font-medium">Docs:</span>{" "}
                    <a
                      href={aiDocsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="underline"
                    >
                      {aiDocsUrl}
                    </a>
                  </li>
                )}
                {aiApiUrl && (
                  <li>
                    <span className="font-medium">API:</span>{" "}
                    <a
                      href={aiApiUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="underline"
                    >
                      {aiApiUrl}
                    </a>
                  </li>
                )}
                {aiCapabilities.length > 0 && (
                  <li>
                    <span className="font-medium">Capabilities:</span>{" "}
                    {aiCapabilities.join(", ")}
                  </li>
                )}
                {aiInputModes.length > 0 && (
                  <li>
                    <span className="font-medium">Input modes:</span>{" "}
                    {aiInputModes.join(", ")}
                  </li>
                )}
                {aiOutputModes.length > 0 && (
                  <li>
                    <span className="font-medium">Output modes:</span>{" "}
                    {aiOutputModes.join(", ")}
                  </li>
                )}
              </ul>
            </section>
          )}

          {/* Latest Update (✅ gated) */}
          {updateMessage && (
            <section className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide">
                  Latest update
                </span>
                {updatedDate && (
                  <span className="text-xs text-amber-800">• {updatedDate}</span>
                )}
              </div>
              <p className="mt-1 whitespace-pre-wrap">{updateMessage}</p>
              <p className="mt-1 text-[11px] text-amber-800/80">
                AEOBRO exposes this in machine-readable JSON-LD so AI systems can
                see what&apos;s new.
              </p>
            </section>
          )}
        </header>

        {/* Branding & Media – only when content exists */}
        {hasBrandingContent && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Branding &amp; Media</h2>
            {bio && (
              <div>
                <h3 className="text-sm font-semibold mb-1">About</h3>
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{bio}</p>
              </div>
            )}

            {imageUrls.length > 0 && (
              <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {imageUrls.map((url, idx) => (
                  <div
                    key={`${url}-${idx}`}
                    className="overflow-hidden rounded-xl border bg-white"
                  >
                    <OptimizedImg
                      src={url}
                      alt={`${displayName} image ${idx + 1}`}
                      className="h-full w-full object-cover"
                      width={600}
                      height={400}
                    />
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Website, Location, Reach */}
        {(website || location || serviceArea.length > 0) && (
          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Website, Location &amp; Reach</h2>
            {website && (
              <p className="text-sm">
                <span className="font-medium">Website:</span>{" "}
                <a
                  href={website}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 underline"
                >
                  {website}
                </a>
              </p>
            )}
            {location && (
              <p className="text-sm">
                <span className="font-medium">Location:</span> {location}
              </p>
            )}
            {serviceArea.length > 0 && (
              <p className="text-sm">
                <span className="font-medium">Service area:</span>{" "}
                {serviceArea.join(", ")}
              </p>
            )}
          </section>
        )}

        {/* Trust & Authority */}
        {(profile.foundedYear ||
          profile.teamSize ||
          profile.pricingModel ||
          (profile.languages?.length ?? 0) > 0 ||
          profile.hours ||
          profile.certifications) && (
          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Trust &amp; Authority</h2>
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
                  <span className="font-medium">Pricing model:</span>{" "}
                  {profile.pricingModel}
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
                  <span className="font-medium">Certifications:</span>{" "}
                  {profile.certifications}
                </li>
              )}
            </ul>
          </section>
        )}

        {/* Services (✅ gated) */}
        {servicesJson.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Services</h2>
            <ul className="grid gap-4 md:grid-cols-2">
              {servicesJson.map((s, idx) => (
                <li key={`${s.name}-${idx}`} className="rounded-xl border p-4">
                  <div className="font-medium">{s.name}</div>
                  {s.description && (
                    <p className="text-sm text-gray-600 mt-1">{s.description}</p>
                  )}
                  {(s.priceMin || s.priceMax || s.currency || s.priceUnit) && (
                    <div className="text-xs text-gray-700 mt-2">
                      {s.currency ? `${s.currency} ` : ""}
                      {s.priceMin && s.priceMax
                        ? `${s.priceMin}–${s.priceMax}`
                        : s.priceMin
                        ? s.priceMin
                        : s.priceMax
                        ? `Up to ${s.priceMax}`
                        : ""}
                      {s.priceUnit ? ` per ${s.priceUnit}` : ""}
                    </div>
                  )}
                  {s.url && (
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block mt-2 text-blue-600 underline text-xs"
                    >
                      View service page
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* FAQs (✅ gated) */}
        {faqJson.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">FAQs</h2>
            <ul className="space-y-3 text-sm">
              {faqJson.map((f, idx) => (
                <li
                  key={`${f.question}-${idx}`}
                  className="rounded-lg border bg-gray-50 px-3 py-2"
                >
                  <div className="font-medium">{f.question}</div>
                  <div className="mt-1 text-gray-700 whitespace-pre-wrap">
                    {f.answer}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Platform handles */}
        {handleEntries.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Platforms</h2>
            <ul className="list-disc space-y-1 pl-6 text-sm">
              {handleEntries.map(({ key, value }) => (
                <li key={key}>
                  <span className="font-medium">{prettyHandleLabel(key)}:</span>{" "}
                  {value}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Verified platform accounts (OAuth) */}
        {profile.platformAccounts?.length ? (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-neutral-700">Verified on</h2>
            <ul className="space-y-1 text-sm text-neutral-800">
              {profile.platformAccounts.map((a: any) => (
                <li key={a.id}>
                  <span className="font-medium">{a.provider}</span>
                  {a.handle ? <span> · {a.handle}</span> : null}
                  {a.url && (
                    <>
                      {" "}
                      —{" "}
                      <a href={a.url} className="underline" target="_blank" rel="noreferrer">
                        View
                      </a>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* Links */}
        {linksArr.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Links</h2>
            <ul className="list-disc space-y-1 pl-6 text-sm">
              {linksArr
                .filter((l) => l.url)
                .map((l, idx) => (
                  <li key={`${l.url}-${idx}`}>
                    <a href={l.url!} target="_blank" rel="noreferrer" className="underline">
                      {l.label || l.url}
                    </a>
                  </li>
                ))}
            </ul>
          </section>
        )}

        {/* Press */}
        {pressArr.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Press &amp; Mentions</h2>
            <ul className="list-disc space-y-1 pl-6 text-sm">
              {pressArr
                .filter((p) => p.url)
                .map((p, idx) => (
                  <li key={`${p.url}-${idx}`}>
                    <a href={p.url!} target="_blank" rel="noreferrer" className="underline">
                      {p.title || p.url}
                    </a>
                  </li>
                ))}
            </ul>
          </section>
        )}

        {/* JSON-LD tools (gated) */}
        {canUseSchemaTools && (
          <section className="mt-10">
            <h2 className="mb-2 text-lg font-semibold">Schema &amp; JSON-LD</h2>
            <p className="mb-2 text-sm text-gray-600 max-w-xl">
              This profile is eligible for JSON-LD export. You can copy the same
              structured data that AEOBRO exposes to AI systems.
            </p>
            <div className="flex items-center gap-3">
              <SchemaPreviewButton
                slug={slug}
                includeAll={true}
                pretty={true}
                label="Copy formatted JSON-LD"
              />
              <a
                className="text-sm underline"
                href={`/api/profile/${encodeURIComponent(slug)}/schema`}
                rel="noopener noreferrer"
              >
                View raw schema JSON
              </a>
            </div>
          </section>
        )}
      </main>

      {/* JSON-LD injection */}
      {jsonLdPayload.length > 0 && (
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(
              jsonLdPayload.length === 1 ? jsonLdPayload[0] : jsonLdPayload,
              null,
              2
            ),
          }}
        />
      )}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*                               Helpers                                      */
/* -------------------------------------------------------------------------- */

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
