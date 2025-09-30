// lib/schema.ts
// 📅 2025-09-30 12:36 PM ET
import type { Profile } from "@prisma/client";

/** Map editor entityType → schema.org @type */
function schemaTypeFor(entityType?: string, orgHeuristic = false) {
  switch ((entityType || "").toLowerCase()) {
    case "local service":
      return "LocalBusiness";
    case "business":
    case "organization":
      return "Organization";
    case "creator / person":
      return "Person";
    default:
      // Fallback: if it looks like an org, use Organization; else Person
      return orgHeuristic ? "Organization" : "Person";
  }
}

/**
 * Build the primary JSON-LD block for a public profile.
 * - Uses entityType to pick @type
 * - description prefers Bio → Tagline
 * - Consolidates links/socials into sameAs
 * - ❗️Does NOT inline FAQs/Services anymore (these now live in separate tables).
 *   Use buildFAQJsonLd() and buildServiceJsonLd() below.
 */
export function buildProfileSchema(profile: Partial<Profile>, baseUrl: string) {
  const slug = (profile as any)?.slug as string | undefined;
  const url = slug ? `${baseUrl}/p/${slug}` : baseUrl;

  // Core identity
  const displayName = (profile as any)?.displayName as string | null;
  const legalName = (profile as any)?.legalName as string | null;
  const entityType = (profile as any)?.entityType as string | null;

  // Description: Bio → Tagline
  const bio = (profile as any)?.bio as string | null;
  const tagline = (profile as any)?.tagline as string | null;
  const description = bio || tagline || undefined;

  // Image fallbacks (prefer logo for orgs)
  const image =
    ((profile as any)?.logoUrl as string | null) ??
    ((profile as any)?.avatarUrl as string | null) ??
    ((profile as any)?.image as string | null) ??
    undefined;

  // Contact (these keys may or may not exist on your Profile shape — safe casts)
  const email =
    ((profile as any)?.publicEmail as string | null) ??
    ((profile as any)?.email as string | null) ??
    undefined;
  const telephone =
    ((profile as any)?.publicPhone as string | null) ??
    ((profile as any)?.phone as string | null) ??
    undefined;

  // Links / socials → sameAs
  const toUrl = (x: any) => (typeof x === "string" ? x : x?.url);
  const linksArr = Array.isArray((profile as any)?.links) ? (profile as any)?.links : [];
  const socialsArr = Array.isArray((profile as any)?.socialLinks) ? (profile as any)?.socialLinks : [];
  const sameAs = Array.from(
    new Set(
      ([] as any[]).concat(linksArr, socialsArr).map(toUrl).filter(Boolean)
    )
  );
  const sameAsOut = sameAs.length ? sameAs : undefined;

  // Address (optional structured object if present on Profile model)
  const addr = ((profile as any)?.address as any) || {};
  const address =
    addr && (addr.streetAddress || addr.addressLocality || addr.postalCode || addr.addressRegion)
      ? {
          "@type": "PostalAddress",
          streetAddress: addr.streetAddress || undefined,
          addressLocality: addr.addressLocality || addr.city || undefined,
          addressRegion: addr.addressRegion || addr.state || undefined,
          postalCode: addr.postalCode || undefined,
          addressCountry: addr.addressCountry || addr.country || undefined,
        }
      : undefined;

  // Heuristic: treat as org if legalName exists and entityType is missing
  const orgHeuristic = !!legalName && !entityType;
  const schemaType = schemaTypeFor(entityType || undefined, orgHeuristic);

  // Name rules: prefer displayName; for orgs fall back to legalName
  const name =
    (displayName as string | null) ??
    (schemaType !== "Person" ? (legalName as string | null) : null) ??
    undefined;

  const base: any = {
    "@context": "https://schema.org",
    "@type": schemaType,
    "@id": `${url}#profile`,
    url,
    name: name || (legalName || "Profile"),
    description,
    image,
    sameAs: sameAsOut,
    email,
    telephone,
    address,
  };

  // Organization / LocalBusiness extras
  if (schemaType === "Organization" || schemaType === "LocalBusiness") {
    base.legalName = legalName || undefined;

    // Optional: opening hours if you store a simple string
    const hours = (profile as any)?.hours as string | null;
    if (hours) base.openingHours = hours;

    // Optional: languages served (string[] on your model)
    const languages = (profile as any)?.languages as string[] | null;
    if (languages && languages.length) base.availableLanguage = languages;

    // Optional: service area (string[] on your model)
    const serviceArea = (profile as any)?.serviceArea as string[] | null;
    if (serviceArea && serviceArea.length) base.areaServed = serviceArea;

    // Optional: foundedYear / teamSize / pricingModel
    const foundedYear = (profile as any)?.foundedYear as number | null;
    if (foundedYear) base.foundingDate = String(foundedYear);

    const teamSize = (profile as any)?.teamSize as number | null;
    if (teamSize) base.numberOfEmployees = teamSize;

    const pricingModel = (profile as any)?.pricingModel as string | null;
    if (pricingModel) {
      base.additionalProperty = [
        { "@type": "PropertyValue", name: "pricingModel", value: pricingModel },
      ];
    }
  } else {
    // Person extras
    const jobTitle = (profile as any)?.jobTitle as string | null;
    if (jobTitle) base.jobTitle = jobTitle;

    const worksFor =
      ((profile as any)?.organizationName as string | null) ??
      ((profile as any)?.company as string | null) ??
      (legalName as string | null) ??
      undefined;
    if (worksFor) base.worksFor = { "@type": "Organization", name: worksFor };
  }

  // Remove empty values
  for (const k of Object.keys(base)) {
    if (
      base[k] === undefined ||
      base[k] === null ||
      (typeof base[k] === "string" && base[k].trim() === "") ||
      (Array.isArray(base[k]) && base[k].length === 0)
    ) {
      delete base[k];
    }
  }

  return base;
}

/**
 * Build a standalone FAQPage JSON-LD object.
 * Use this alongside the main profile script on the public profile page.
 *
 * @param slug - profile slug (used to form the FAQ section URL)
 * @param faqs - array of { question, answer }
 */
export function buildFAQJsonLd(
  slug: string,
  faqs: Array<{ question: string; answer: string }>
) {
  if (!faqs?.length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((q) => ({
      "@type": "Question",
      name: q.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: q.answer,
      },
    })),
    // Anchor to the FAQ section on the public page
    url: `/p/${slug}#faq`,
  };
}

/**
 * Build Service JSON-LD objects.
 * Returns an array (one schema object per Service).
 *
 * @param providerIdUrl - the @id or URL of the provider (e.g., `${baseUrl}/p/${slug}#profile`)
 * @param services - array of service definitions from DB
 */
export function buildServiceJsonLd(
  providerIdUrl: string,
  services: Array<{
    name: string;
    description?: string | null;
    url?: string | null;
    priceMin?: number | string | null;
    priceMax?: number | string | null;
    priceUnit?: string | null;
    currency?: string | null;
  }>
) {
  if (!services?.length) return [];
  return services.map((svc) => {
    const hasAnyPrice = svc.priceMin !== undefined || svc.priceMax !== undefined;
    const offers =
      hasAnyPrice
        ? {
            "@type": "Offer",
            ...(svc.currency ? { priceCurrency: svc.currency } : {}),
            ...(svc.priceMin !== undefined ? { price: String(svc.priceMin) } : {}),
            ...(svc.priceMax !== undefined
              ? { highPrice: String(svc.priceMax) }
              : {}),
            ...(svc.priceMin !== undefined && svc.priceMax !== undefined
              ? {
                  priceSpecification: {
                    "@type": "PriceSpecification",
                    minPrice: String(svc.priceMin),
                    maxPrice: String(svc.priceMax),
                  },
                }
              : {}),
            ...(svc.url ? { url: svc.url } : {}),
            ...(svc.priceUnit
              ? {
                  eligibleQuantity: {
                    "@type": "QuantitativeValue",
                    unitText: svc.priceUnit,
                  },
                }
              : {}),
          }
        : undefined;

    const obj: any = {
      "@context": "https://schema.org",
      "@type": "Service",
      name: svc.name,
      provider: providerIdUrl, // link back to the main entity
    };

    if (svc.description) obj.description = svc.description;
    if (svc.url) obj.url = svc.url;
    if (offers) obj.offers = offers;

    return obj;
  });
}
