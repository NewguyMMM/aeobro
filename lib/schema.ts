// lib/schema.ts
// 📅 Updated: 2026-02-16 02:19 ET
// Fix: allow schema endpoint to "force remove" updateMessage by passing null.
// IMPORTANT:
// - latestUpdateRaw === null => suppress latestUpdate (used for LITE/inactive publish gating)
// - latestUpdateRaw === undefined => use profile.updateMessage (backward compatible)

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
  const asUrl = sanitizeUrl(typeof raw === "string" ? raw : raw?.url);
  if (asUrl) return asUrl;

  const vRaw = typeof raw === "string" ? raw : raw?.handle ?? "";
  const v = sanitizeText(vRaw, 120);
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

/** Build Event object from a loose event/news shape */
function buildEventLike(e: any) {
  if (!e) return null;
  const name = sanitizeText(e.name ?? e.title ?? e.headline ?? "", 200) || null;
  const url = sanitizeUrl(e.url ?? null) || undefined;
  const startDate = e.startDate ?? e.date ?? e.start_time ?? undefined;
  const endDate = e.endDate ?? e.end_time ?? undefined;
  const description = e.description ? sanitizeText(e.description, 500) : undefined;

  if (!name && !url && !startDate && !description) return null;

  const obj: any = { "@type": "Event" };
  if (name) obj.name = name;
  if (url) obj.url = url;
  if (startDate) obj.startDate = startDate;
  if (endDate) obj.endDate = endDate;
  if (description) obj.description = description;
  return obj;
}

/** Build CreativeWork for “news” items */
function buildNewsLike(n: any) {
  if (!n) return null;
  const headline = sanitizeText(n.headline ?? n.title ?? n.name ?? "", 200) || null;
  const url = sanitizeUrl(n.url ?? null) || undefined;
  const datePublished = n.datePublished ?? n.publishedAt ?? n.date ?? undefined;
  const description = n.description ? sanitizeText(n.description, 500) : undefined;

  if (!headline && !url && !datePublished && !description) return null;

  const obj: any = { "@type": "CreativeWork" };
  if (headline) obj.headline = headline;
  if (url) obj.url = url;
  if (datePublished) obj.datePublished = datePublished;
  if (description) obj.description = description;
  return obj;
}

/** Helper: compose "City, ST" (or free-text) for Person.homeLocation */
function composeLocationText(profile: any, addressLocality?: string, addressRegion?: string) {
  const locationTextRaw = profile?.location as string | null;
  const fromField = locationTextRaw ? sanitizeText(locationTextRaw, 200) : undefined;
  const fromAddress =
    (addressLocality || addressRegion)
      ? [addressLocality, addressRegion].filter(Boolean).join(", ")
      : undefined;
  return fromField || fromAddress || undefined;
}

/** Helper: normalize service area into array or a single string */
function normalizeServiceArea(profile: any): string[] | string | undefined {
  const arr = Array.isArray(profile?.serviceArea)
    ? profile.serviceArea.map((s: any) => sanitizeText(String(s), 80)).filter(Boolean)
    : [];
  const single =
    profile?.serviceAreaText && String(profile.serviceAreaText).trim()
      ? sanitizeText(String(profile.serviceAreaText), 120)
      : undefined;
  if (arr.length) return arr;
  if (single) return single.toLowerCase() === "the world" ? "Worldwide" : single;
  return undefined;
}

/** Helper: ensure additionalProperty exists and push */
function pushAdditional(base: any, name: string, value: string | number) {
  if (value === undefined || value === null || (typeof value === "string" && !value.trim()))
    return;
  const pv = { "@type": "PropertyValue", name, value };
  if (!base.additionalProperty) base.additionalProperty = [pv];
  else base.additionalProperty.push(pv);
}

/** Build the primary JSON-LD block for a public profile. */
export function buildProfileSchema(
  profile: Partial<Profile>,
  baseUrl: string,
  latestUpdateRaw?: string | null
) {
  const slug = (profile as any)?.slug as string | undefined;
  const url = slug ? `${baseUrl}/p/${sanitizeText(slug, 120)}` : baseUrl;

  // Core identity
  const displayNameRaw = (profile as any)?.displayName as string | null;
  const legalNameRaw = (profile as any)?.legalName as string | null;
  const entityTypeRaw = (profile as any)?.entityType as string | null;

  const displayName = displayNameRaw ? sanitizeText(displayNameRaw, 200) : null;
  const legalName = legalNameRaw ? sanitizeText(legalNameRaw, 200) : null;
  const entityType = entityTypeRaw ? sanitizeText(entityTypeRaw, 50) : null;

  // Description: Bio → Tagline
  const bioRaw = (profile as any)?.bio as string | null;
  const taglineRaw = (profile as any)?.tagline as string | null;
  const description =
    sanitizeText(bioRaw ?? "", 5000) || sanitizeText(taglineRaw ?? "", 500) || undefined;

  // 🔹 Latest update (updateMessage)
  // IMPORTANT:
  // - null means "force no update message" (used for LITE/inactive publish gating)
  // - undefined means "use profile.updateMessage"
  const updateMessageSource =
    latestUpdateRaw !== undefined
      ? latestUpdateRaw
      : (((profile as any)?.updateMessage as string | null) ?? null);

  const latestUpdate = updateMessageSource
    ? sanitizeText(updateMessageSource, 500)
    : null;

  // Images
  const imagesSet = new Set<string>();
  const logoUrl = sanitizeUrl((profile as any)?.logoUrl as string | null);
  const avatarUrl = sanitizeUrl((profile as any)?.avatarUrl as string | null);
  const imageUrl = sanitizeUrl((profile as any)?.image as string | null);
  if (logoUrl) imagesSet.add(logoUrl);
  if (avatarUrl) imagesSet.add(avatarUrl);
  if (imageUrl) imagesSet.add(imageUrl);
  const imageUrls = Array.isArray((profile as any)?.imageUrls)
    ? (profile as any).imageUrls
    : [];
  for (const u of imageUrls) {
    const s = sanitizeUrl(u);
    if (s) imagesSet.add(s);
  }
  const images = Array.from(imagesSet);
  const imageOut = images.length === 0 ? undefined : images.length === 1 ? images[0] : images;

  // Contact
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

  // sameAs: website + links + socials + handles
  const sameAsSet = new Set<string>();
  const websiteUrl = sanitizeUrl((profile as any)?.website as string | null);
  if (websiteUrl) sameAsSet.add(websiteUrl);

  const toMaybeUrl = (x: any): string | null => {
    const u = typeof x === "string" ? x : x?.url;
    return sanitizeUrl(u);
  };

  const linksArr = Array.isArray((profile as any)?.links) ? (profile as any).links : [];
  const socialsArr = Array.isArray((profile as any)?.socialLinks)
    ? (profile as any).socialLinks
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

  // Address
  const addr = ((profile as any)?.address as any) || {};
  const streetAddress = addr?.streetAddress ? sanitizeText(addr.streetAddress, 200) : undefined;
  const addressLocality =
    (addr?.addressLocality || addr?.city)
      ? sanitizeText(addr.addressLocality || addr.city, 120)
      : undefined;
  const addressRegion =
    (addr?.addressRegion || addr?.state)
      ? sanitizeText(addr.addressRegion || addr.state, 60)
      : undefined;
  const postalCode = addr?.postalCode ? sanitizeText(addr.postalCode, 40) : undefined;
  const addressCountry =
    (addr?.addressCountry || addr?.country)
      ? sanitizeText(addr.addressCountry || addr.country, 60)
      : undefined;

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

  // Heuristic → @type
  const orgHeuristic = !!legalName && !entityType;
  const preliminaryType = schemaTypeFor(entityType || undefined, orgHeuristic);

  // Verification gating
  const verificationStatus = (profile as any)?.verificationStatus as string | null;
  const schemaType = applyVerificationGating(preliminaryType as any, verificationStatus);
  if (!schemaType) return null;

  // Name rules
  const name = displayName ?? (schemaType !== "Person" ? legalName : null) ?? undefined;

  const base: any = {
    "@context": "https://schema.org",
    "@type": schemaType,
    "@id": `${url}#profile`,
    url,
    name: name || sanitizeText(legalName || "Profile", 200),
    ...(description ? { description } : {}),
    ...(imageOut ? { image: imageOut } : {}),
    ...(sameAsOut ? { sameAs: sameAsOut } : {}),
    ...(email ? { email } : {}),
    ...(telephone ? { telephone } : {}),
    ...(address ? { address } : {}),
  };

  // ---- Mentions (Press) ----
  const pressArr = Array.isArray((profile as any)?.press) ? (profile as any).press : [];
  const mentions = pressArr
    .map((p: any) => {
      const url = sanitizeUrl(p?.url);
      const title =
        p?.title
          ? sanitizeText(p.title, 200)
          : p?.name
          ? sanitizeText(p.name, 200)
          : p?.label
          ? sanitizeText(p.label, 200)
          : undefined;

      if (!url && !title) return null; // need at least one
      const cw: any = { "@type": "CreativeWork" };
      if (url) cw.url = url;
      if (title) cw.name = title;
      return cw;
    })
    .filter(Boolean);
  if (mentions.length) base.mentions = mentions;

  // ---- Certifications / Awards ----
  const certs = (profile as any)?.certifications;
  if (Array.isArray(certs)) {
    const awards = certs.map((c: any) => sanitizeText(String(c), 160)).filter(Boolean);
    if (awards.length) base.award = awards;
  } else if (typeof certs === "string" && certs.trim()) {
    base.award = sanitizeText(certs, 400);
  }

  // ---- Events & News → subjectOf ----
  const subjectOf: any[] = [];
  const eventsArr = Array.isArray((profile as any)?.events) ? (profile as any).events : [];
  for (const e of eventsArr) {
    const ev = buildEventLike(e);
    if (ev) subjectOf.push(ev);
  }
  const newsArr = Array.isArray((profile as any)?.news) ? (profile as any).news : [];
  for (const n of newsArr) {
    const nw = buildNewsLike(n);
    if (nw) subjectOf.push(nw);
  }
  if (subjectOf.length) base.subjectOf = subjectOf;

  // ----- Location & Service Area -----
  const normalizedServiceArea = normalizeServiceArea(profile as any);
  const locationText = composeLocationText(profile as any, addressLocality, addressRegion);

  // Trust/authority inputs (used below in both branches)
  const foundedYear = (profile as any)?.foundedYear as number | null;
  const teamSize = (profile as any)?.teamSize as number | null;
  const pricingModelRaw = (profile as any)?.pricingModel as string | null;
  const pricingModel = pricingModelRaw ? sanitizeText(pricingModelRaw, 40) : null;

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

    if (normalizedServiceArea) base.areaServed = normalizedServiceArea;

    if (foundedYear) base.foundingDate = String(foundedYear);
    if (teamSize) base.numberOfEmployees = teamSize;
    if (pricingModel) pushAdditional(base, "pricingModel", pricingModel);
    // 🔹 Latest update as an additionalProperty for org/local service
    if (latestUpdate) pushAdditional(base, "latestUpdate", latestUpdate);
  } else {
    // Person extras
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

    if (locationText) base.homeLocation = { "@type": "Place", name: locationText };
    if (normalizedServiceArea) base.areaServed = normalizedServiceArea;

    // Person fields mirroring org trust details
    const languagesRaw = (profile as any)?.languages as string[] | null;
    const knowsLang = Array.isArray(languagesRaw)
      ? languagesRaw.map((s) => sanitizeText(s, 60)).filter(Boolean)
      : [];
    if (knowsLang.length) base.knowsLanguage = knowsLang;

    const hoursRaw = (profile as any)?.hours as string | null;
    const hours = hoursRaw ? sanitizeText(hoursRaw, 160) : null;
    if (hours) pushAdditional(base, "hours", hours);

    if (foundedYear) pushAdditional(base, "foundedYear", String(foundedYear));
    if (teamSize) pushAdditional(base, "teamSize", teamSize!);
    if (pricingModel) pushAdditional(base, "pricingModel", pricingModel);
    // 🔹 Latest update for Person as well
    if (latestUpdate) pushAdditional(base, "latestUpdate", latestUpdate);
  }

  // Remove empty/blank values
  for (const k of Object.keys(base)) {
    if (
      base[k] === undefined ||
      base[k] === null ||
      (typeof base[k] === "string" && base[k].trim() === "") ||
      (Array.isArray(base[k]) && base[k].length === 0)
    ) {
      delete (base as any)[k];
    }
  }

  return base;
}

/** FAQ JSON-LD (sanitized) */
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
        acceptedAnswer: { "@type": "Answer", text: answer },
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

/** Services JSON-LD (sanitized) */
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

      const offers = hasAnyPrice
        ? {
            "@type": "Offer",
            ...(currency ? { priceCurrency: currency } : {}),
            ...(svc.priceMin !== undefined && svc.priceMin !== null
              ? { price: String(svc.priceMin) }
              : {}),
            ...(svc.priceMax !== undefined && svc.priceMax !== null
              ? { highPrice: String(svc.priceMax) }
              : {}),
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
              ? { eligibleQuantity: { "@type": "QuantitativeValue", unitText: priceUnit } }
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
