// app/p/[slug]/page.tsx
import { prisma } from "@/lib/prisma";
import { buildProfileSchema } from "@/lib/schema";
import { getBaseUrl } from "@/lib/getBaseUrl";
import Script from "next/script";
import { notFound } from "next/navigation";

type PageProps = {
  params: { slug: string };
};

// If your profiles change occasionally, ISR keeps it fresh without slowing requests.
export const revalidate = 60; // seconds

export default async function PublicProfilePage({ params }: PageProps) {
  const { slug } = params;

  // Fetch by slug — ensure you have a unique index on Profile.slug
  const profile = await prisma.profile.findUnique({
    where: { slug },
  });

  if (!profile) {
    notFound();
  }

  const baseUrl = getBaseUrl();
  const schema = buildProfileSchema(profile, baseUrl);

  // Human-readable rendering (keep simple and robust)
  const displayName =
    (profile as any).displayName ||
    (profile as any).name ||
    (profile as any).organizationName ||
    slug;

  const headline =
    (profile as any).headline ||
    (profile as any).tagline ||
    (profile as any).bio ||
    "";

  const image =
    (profile as any).image ||
    (profile as any).avatarUrl ||
    (profile as any).logoUrl ||
    null;

  const sameAs: string[] =
    ((profile as any).links && Array.isArray((profile as any).links)
      ? (profile as any).links
      : (profile as any).socialLinks) || [];

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
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt={displayName}
            className="h-24 w-24 rounded-2xl object-cover mb-4"
          />
        ) : null}

        <h1 className="text-3xl font-semibold">{displayName}</h1>
        {headline ? (
          <p className="text-muted-foreground mt-2">{headline}</p>
        ) : null}

        <p className="text-sm mt-4 text-gray-500">
          Canonical: <a href={`${baseUrl}/p/${slug}`}>{baseUrl}/p/{slug}</a>
        </p>
      </header>

      {/* Social / Links */}
      {Array.isArray(sameAs) && sameAs.length > 0 ? (
        <section className="mt-6">
          <h2 className="text-lg font-medium mb-3">Links</h2>
          <ul className="list-disc pl-6 space-y-1">
            {sameAs.map((href: string, i: number) => (
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
