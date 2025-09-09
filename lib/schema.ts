// lib/schema.ts
import type { Profile } from "@prisma/client";

/**
 * Build JSON-LD (schema.org) for a public profile.
 * Adjust mapping to your Prisma shape as needed.
 */
export function buildProfileSchema(profile: Partial<Profile>, baseUrl: string) {
  const url = `${baseUrl}/p/${profile.slug}`;
  const name =
    profile["displayName" as keyof Profile] ??
    profile["name" as keyof Profile] ??
    profile["headline" as keyof Profile] ??
    "Profile";

  const description =
    (profile["bio" as keyof Profile] as string | null) ??
    (profile["description" as keyof Profile] as string | null) ??
    undefined;

  // Try common image fields
  const image =
    (profile["image" as keyof Profile] as string | null) ??
    (profile["avatarUrl" as keyof Profile] as string | null) ??
    undefined;

  // Organization / business details if present
  const orgName =
    (profile["organizationName" as keyof Profile] as string | null) ??
    (profile["company" as keyof Profile] as string | null) ??
    undefined;

  // Contact
  const email =
    (profile["publicEmail" as keyof Profile] as string | null) ??
    (profile["email" as keyof Profile] as string | null) ??
    undefined;

  const telephone =
    (profile["publicPhone" as keyof Profile] as string | null) ??
    (profile["phone" as keyof Profile] as string | null) ??
    undefined;

  const sameAs: string[] =
    (profile["links" as keyof Profile] as any)?.filter?.((x: any) =>
      typeof x === "string"
    ) ??
    (profile["socialLinks" as keyof Profile] as any)?.filter?.((x: any) =>
      typeof x === "string"
    ) ??
    [];

  // Postal address if you store it (defensive)
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

  // Decide Person vs Organization
  const isOrg =
    (profile["profileType" as keyof Profile] as string | null) ===
      "organization" ||
    (!!orgName && !name); // heuristic

  const base: any = {
    "@context": "https://schema.org",
    "@type": isOrg ? "Organization" : "Person",
    url,
    name: String(name || orgName || "Profile"),
    description,
    image,
    sameAs: sameAs.length ? sameAs : undefined,
  };

  if (isOrg) {
    base.legalName = orgName || undefined;
    base.email = email || undefined;
    base.telephone = telephone || undefined;
    base.address = address || undefined;
  } else {
    // Person
    base.email = email || undefined;
    base.telephone = telephone || undefined;
    base.address = address || undefined;
    // Optional: jobTitle, worksFor, etc. if you store them
    const jobTitle =
      (profile["jobTitle" as keyof Profile] as string | null) || undefined;
    const worksFor =
      (profile["organizationName" as keyof Profile] as string | null) ||
      undefined;

    base.jobTitle = jobTitle;
    base.worksFor = worksFor
      ? { "@type": "Organization", name: worksFor }
      : undefined;
  }

  // Clean undefined
  Object.keys(base).forEach((k) => base[k] === undefined && delete base[k]);
  return base;
}
