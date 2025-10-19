// lib/schema.ts
// 📅 2025-10-18 04:22 PM ET
import type { Profile } from "@prisma/client";
import { sanitizeText, sanitizeUrl } from "@/lib/sanitize";

/** Map editor entityType → schema.org @type (pre-gating) */
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
      return orgHeuristic ? "Organization" : "Person";
  }
}

/** After deciding a desired type, gate what is actually allowed to export */
function applyVerificationGating(
  desiredType: "Organization" | "LocalBusiness" | "Person",
  verificationStatus?: string | null
): "Organization" | "LocalBusiness" | "Person" | null {
  const status = (verificationStatus || "UNVERIFIED").toUpperCase();
  if (desiredType === "Organization" || desiredType === "LocalBusiness") {
    if (status === "DOMAIN_VERIFIED") return desiredType;
    if (status === "PLATFORM_VERIFIED") return "Person";
    if (status === "UNVERIFIED") return "Person";
  }
  return desiredType;
}

/** Turn a platform handle or url into a canonical https URL (if possible). */
function handleToCanonicalUrl(key: string, raw: any): string | null {
  // First: if they already gave us a full URL, honor it.
  const asUrl = sanitizeUrl(typeof raw === "string" ? raw : raw?.url);
  if (asUrl) return asUrl;

  // Else try to build a canonical URL from a handle string
  const vRaw = typeof raw === "string" ? raw : raw?.handle ?? "";
  const v = sanitizeText(vRaw, 120);
  if (!v) return null;

  // strip leading @ for platforms that use @
  const noAt = v.replace(/^@/, "");

  // conservative guards: no spaces, no quotes
  if (/\s|["'<>\u0000]/.test(noAt)) return null;

  const k = (key || "").toLowerCase();

  switch (k) {
    case "youtube":
      // prefer channel/handle-style URL
      return `https://www.youtube.com/@${noAt}`;
    case "tiktok":
      return `https://www.tiktok.com/@${noAt}`;
    case "instagram":
      return `https://www.instagram.com/${noAt}`;
    case "x":
    case "twitter":
      return `https://twitter.com/${noAt}`;
    case "linkedin":
      // could be company or in/username — we can't know; default to "in"
      return `https://www.linkedin.com/in/${noAt}`;
    case "facebook":
      return `https://www.facebook.com/${noAt}`;
    case "github":
      return `https://github.com/${noAt}`;
    case "substack":
      // either full url or subdomain
      return `https://${noAt}.substack.com/`;
    case "etsy":
      // shop name canonicalization
      return `https://www.etsy.com/shop/${noAt}`;
    default:
      return null;
  }
}

/**
 * Build the primary JSON-LD block for a public profile.
 * - Uses entityType to pick @type, then applies verification gating
 * - description prefers Bio → Tagline
 * - Consolidates website + links + socials + handles into sameAs
 * - FAQs/Services are separate JSON-LD builders (below)
 *
 * All user-controlled fields are sanitized.
 */
export function buildProfileSchema(profile: Partial<Profile>, baseUrl: string) {
  const slug = (profile as any)?.slug as string | undefined;
  const url = slug ? `${baseUrl}/p/${sanitizeText(slug, 120)}` : baseUrl;

  // Core identity (sanitized)
  const displayNameRaw = (profile as any)?.displayName as string | null;
  const legalNameRaw = (profile as any)?.legalName as string | null;
  const entityTypeRaw = (profile as any)?.entityType as string | null;

  const displayName = displayNameRaw ? sanitizeText(displayNameRaw, 200) : null;
  const legalName = legalNameRaw ? sanitizeText(legalNameRaw, 200) : null;
  const entityType = entityTypeRaw ? sanitizeText(entityTypeRaw, 50) : null;

  // Description: Bio → Tagline (sanitized)
  const bioRaw = (profile as any)?.bio as string | null;
  const taglineRaw = (profile as any)?.tagline as string | null;
  const description =
    sanitizeText(bioRaw ?? "", 5000) ||
    sanitizeText(taglineRaw ?? "", 500) ||
    undefined;

  // Image/Logo (URLs sanitized)
  const logoUrl = sanitizeUrl((profile as any)?.logoUrl as string | null);
  const avatarUrl = sanitizeUrl((profile as any)?.avatarUrl as string | null);
  const imageUrl = sanitizeUrl((profile as any)?.image as string | null);
  const image = logoUrl || avatarUrl || imageUrl || undefined;

  // Contact (sanitized)
  const emailRaw =
    ((profile as any)?.publicEmail as string | null) ??
    ((profile as any)?.email as string | null) ??
    null;
  const telephoneRaw =
    ((profile as any)?.publicPhone as string | null) ??
    ((profile as any)?.phone as string | null) ??
    null;
  const email = emailRaw ? sanitizeText(emailRaw, 200) : undefined;
  const telephone = telephoneRaw ? sanitizeText(telephoneRaw, 50) : undefined;

  // sameAs: website + links + socialLinks + handles (canonicalized)
  const sameAsSet = new Set<string>();

  const websiteUrl = sanitizeUrl((profile as any)?.website as string | null);
  if (websiteUrl) sameAsSet.add(websiteUrl);

  const toMaybeUrl = (x: any): string | null => {
    const u = typeof x === "string" ? x : x?.url;
    return sanitizeUrl(u);
  };

  const linksArr = Array.isArray((profile as any)?.links)
    ? (profile as any)?.links
    : [];
  const socialsArr = Array.isArray((profile as any)?.socialLinks)
    ? (profile as any)?.socialLinks
    : [];

  ([] as any[]).concat(linksArr, socialsArr).forEach((v) => {
    const u = toMaybeUrl(v);
    if (u) sameAsSet.add(u);
  });

  const handlesObj = (profile as any)?.handles || {};
  if (handlesObj && typeof handlesObj === "object") {
    for (const [key, val] of Object.entries(handlesObj)) {
      const canon = handleToCanonicalUrl(key, val);
      if (canon) sameAsSet.add(canon);
    }
  }

  const sameAs = Array.from(sameAsSet);
  const sameAsOut = sameAs.length ? sameAs : undefined;

  // Address (sanitized optional structured object)
  const addr = ((profile as any)?.address as any) || {};
  const streetAddress = addr?.streetAddress ? sanitizeText(addr.streetAddress, 200) : undefined;
  const addressLocality = (addr?.addressLocality || addr?.city) ? sanitizeText(addr.addressLocality || addr.city, 120) : undefined;
  const addressRegion = (addr?.addressRegion || addr?.state) ? sanitizeText(addr.addressRegion || addr.state, 60) : undefined;
  const postalCode = addr?.postalCode ? sanitizeText(addr.postalCode, 40) : undefined;
  const addressCountry = (addr?.addressCountry || addr?.country) ? sanitizeText(addr.addressCountry || addr.country, 60) : undefined;
  const address =
    streetAddress || addressLocality || addressRegion || postalCode || addressCountry
      ? {
          "@type": "PostalAddress",
          streetAddress,
          addressLocality,
          addressRegion,
          postalCode,
          addressCountry,
        }
      : undefined;

  // Heuristic: treat as org if legalName exists and entityType is missing
  const orgHeuristic = !!legalName && !entityType;
  const preliminaryType = schemaTypeFor(entityType || undefined, orgHeuristic);

  // Apply verification gating
  const verificationStatus = (profile as any)?.verificationStatus as string | null;
  const schemaType = applyVerificationGating(preliminaryType as any, verificationStatus);
  if (!schemaType) return null;

  // Name rules: prefer displayName; for orgs fall back to legalName
  const name =
    displayName ??
    (schemaType !== "Person" ? legalName : null) ??
    undefined;

  const base: any = {
    "@context": "https://schema.org",
    "@type": schemaType,
    "@id": `${url}#profile`,
    url,
    name: name || sanitizeText(legalName || "Profile", 200),
    ...(description ? { description } : {}),
    ...(image ? { image } : {}),
    ...(sameAsOut ? { sameAs: sameAsOut } : {}),
    ...(email ? { email } : {}),
    ...(telephone ? { telephone } : {}),
    ...(address ? { address } : {}),
  };

  if (schemaType === "Organization" || schemaType === "LocalBusiness") {
    base.legalName = legalName || undefined;

    const hoursRaw = (profile as any)?.hours as string | null;
    const hours = hoursRaw ? sanitizeText(hoursRaw, 160) : null;
    if (hours) base.openingHours = hours;

    const languagesRaw = (profile as any)?.languages as string[] | null;
    const languages = Array.isArray(languagesRaw)
      ? languagesRaw.map((s) => sanitizeText(s, 60)).filter(Boolean)
      : [];
    if (languages.length) base.availableLanguage = languages;

    const serviceAreaRaw = (profile as any)?.serviceArea as string[] | null;
    const serviceArea = Array.isArray(serviceAreaRaw)
      ? serviceAreaRaw.map((s) => sanitizeText(s, 80)).filter(Boolean)
      : [];
    if (serviceArea.length) base.areaServed = serviceArea;

    const foundedYear = (profile as any)?.foundedYear as number | null;
    if (foundedYear) base.foundingDate = String(foundedYear);

    const teamSize = (profile as any)?.teamSize as number | null;
    if (teamSize) base.numberOfEmployees = teamSize;

    const pricingModelRaw = (profile as any)?.pricingModel as string | null;
    const pricingModel = pricingModelRaw ? sanitizeText(pricingModelRaw, 40) : null;
    if (pricingModel) {
      base.additionalProperty = [
        { "@type": "PropertyValue", name: "pricingModel", value: pricingModel },
      ];
    }
  } else {
    const jobTitleRaw = (profile as any)?.jobTitle as string | null;
    const jobTitle = jobTitleRaw ? sanitizeText(jobTitleRaw, 120) : null;
    if (jobTitle) base.jobTitle = jobTitle;

    const worksForRaw =
      ((profile as any)?.organizationName as string | null) ??
      ((profile as any)?.company as string | null) ??
      legalName ??
      null;
    const worksFor = worksForRaw ? sanitizeText(worksForRaw, 200) : null;
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

/** FAQ JSON-LD unchanged */
export function buildFAQJsonLd(
  slug: string,
  faqs: Array<{ question: string; answer: string }>
) {
  if (!faqs?.length) return null;

  const safeSlug = sanitizeText(slug, 120);
  const mainEntity = faqs
    .map((q) => {
      const question = sanitizeText(q.question, 500);
      const answer = sanitizeText(q.answer, 4000);
      if (!question || !answer) return null;
      return {
        "@type": "Question",
        name: question,
        acceptedAnswer: {
          "@type": "Answer",
          text: answer,
        },
      };
    })
    .filter(Boolean) as Array<any>;

  if (!mainEntity.length) return null;

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity,
    url: `/p/${safeSlug}#faq`,
  };
}

/** Services JSON-LD unchanged */
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

  const provider = sanitizeUrl(providerIdUrl) || sanitizeText(providerIdUrl, 2048);

  return services
    .map((svc) => {
      const name = sanitizeText(svc.name, 200);
      if (!name) return null;

      const description = svc.description ? sanitizeText(svc.description, 2000) : undefined;
      const url = svc.url ? sanitizeUrl(svc.url) : undefined;

      const hasAnyPrice =
        svc.priceMin !== undefined && svc.priceMin !== null
          ? true
          : svc.priceMax !== undefined && svc.priceMax !== null;

      const currency = svc.currency ? sanitizeText(svc.currency, 10) : undefined;
      const priceUnit = svc.priceUnit ? sanitizeText(svc.priceUnit, 40) : undefined;

      const offers =
        hasAnyPrice
          ? {
              "@type": "Offer",
              ...(currency ? { priceCurrency: currency } : {}),
              ...(svc.priceMin !== undefined && svc.priceMin !== null ? { price: String(svc.priceMin) } : {}),
              ...(svc.priceMax !== undefined && svc.priceMax !== null ? { highPrice: String(svc.priceMax) } : {}),
              ...(svc.priceMin !== undefined &&
              svc.priceMin !== null &&
              svc.priceMax !== undefined &&
              svc.priceMax !== null
                ? {
                    priceSpecification: {
                      "@type": "PriceSpecification",
                      minPrice: String(svc.priceMin),
                      maxPrice: String(svc.priceMax),
                    },
                  }
                : {}),
              ...(url ? { url } : {}),
              ...(priceUnit
                ? {
                    eligibleQuantity: {
                      "@type": "QuantitativeValue",
                      unitText: priceUnit,
                    },
                  }
                : {}),
            }
          : undefined;

      const obj: any = {
        "@context": "https://schema.org",
        "@type": "Service",
        name,
        provider,
      };

      if (description) obj.description = description;
      if (url) obj.url = url;
      if (offers) obj.offers = offers;

      return obj;
    })
    .filter(Boolean) as any[];
}
