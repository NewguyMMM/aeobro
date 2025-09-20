// lib/schema.ts
import type { Profile } from "@prisma/client";

/**
 * Build JSON-LD (schema.org) for a public profile.
 * Expands to Person vs Organization, with optional FAQ/Service hooks.
 */
export function buildProfileSchema(profile: Partial<Profile>, baseUrl: string) {
  const slug = profile["slug" as keyof Profile] as string | undefined;
  const url = slug ? `${baseUrl}/p/${slug}` : baseUrl;

  const name =
    (profile["displayName" as keyof Profile] as string | null) ??
    (profile["name" as keyof Profile] as string | null) ??
    (profile["headline" as keyof Profile] as string | null) ??
    undefined;

  const description =
    (profile["bio" as keyof Profile] as string | null) ??
    (profile["description" as keyof Profile] as string | null) ??
    undefined;

  // Images
  const image =
    (profile["image" as keyof Profile] as string | null) ??
    (profile["avatarUrl" as keyof Profile] as string | null) ??
    undefined;

  // Organization details
  const orgName =
    (profile["organizationName" as keyof Profile] as string | null) ??
    (profile["company" as keyof Profile] as string | null) ??
    undefined;

  // Contact info
  const email =
    (profile["publicEmail" as keyof Profile] as string | null) ??
    (profile["email" as keyof Profile] as string | null) ??
    undefined;

  const telephone =
    (profile["publicPhone" as keyof Profile] as string | null) ??
    (profile["phone" as keyof Profile] as string | null) ??
    undefined;

  // Links / handles
  let sameAs: string[] = [];
  const links = profile["links" as keyof Profile] as any;
  const socials = profile["socialLinks" as keyof Profile] as any;
  if (Array.isArray(links)) {
    sameAs = sameAs.concat(links.map((x) => (typeof x === "string" ? x : x?.url)).filter(Boolean));
  }
  if (Array.isArray(socials)) {
    sameAs = sameAs.concat(socials.map((x) => (typeof x === "string" ? x : x?.url)).filter(Boolean));
  }

  // Postal address
  const addr = (profile["address" as keyof Profile] as any) || {};
  const address =
    addr && (addr.streetAddress || addr.addressLocality || addr.postalCode)
      ? {
          "@type": "PostalAddress",
          streetAddress: addr.streetAddress || undefined,
          addressLocality: addr.addressLocality || addr.city || undefined,
          addressRegion: addr.addressRegion || addr.state || undefined,
          postalCode: addr.postalCode || undefined,
          addressCountry: addr.addressCountry || addr.country || undefined,
        }
      : undefined;

  // Profile type
  const isOrg =
    (profile["profileType" as keyof Profile] as string | null)?.toLowerCase() === "organization" ||
    (!!orgName && !name);

  // Base schema
  const base: any = {
    "@context": "https://schema.org",
    "@type": isOrg ? "Organization" : "Person",
    "@id": `${url}#profile`,
    url,
    name: String(name || orgName || "Profile"),
    description,
    image,
    sameAs: sameAs.length ? Array.from(new Set(sameAs)) : undefined,
    email,
    telephone,
    address,
  };

  if (isOrg) {
    base.legalName = orgName || undefined;
    // Optional: business services or FAQ markup (Pro/Business only)
    if (profile["faqs" as keyof Profile]) {
      base.mainEntity = (profile["faqs" as keyof Profile] as any[]).map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      }));
    }
    if (profile["services" as keyof Profile]) {
      base.hasOfferCatalog = {
        "@type": "OfferCatalog",
        name: `${orgName} Services`,
        itemListElement: (profile["services" as keyof Profile] as any[]).map((s) => ({
          "@type": "Offer",
          itemOffered: { "@type": "Service", name: s.name, description: s.desc },
        })),
      };
    }
  } else {
    // Person extras
    const jobTitle = (profile["jobTitle" as keyof Profile] as string | null) || undefined;
    const worksFor =
      (profile["organizationName" as keyof Profile] as string | null) ||
      (profile["company" as keyof Profile] as string | null) ||
      undefined;
    if (jobTitle) base.jobTitle = jobTitle;
    if (worksFor) base.worksFor = { "@type": "Organization", name: worksFor };
  }

  // Strip empties
  Object.keys(base).forEach((k) => {
    if (base[k] === undefined || base[k] === null || base[k] === "") {
      delete base[k];
    }
  });

  return base;
}
