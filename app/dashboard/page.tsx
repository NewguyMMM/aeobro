// app/dashboard/page.tsx
export const runtime = "nodejs";          // Prisma needs Node runtime (not Edge)
export const dynamic = "force-dynamic";   // always SSR; no static export

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import ProfileEditor from "@/components/ProfileEditor";

type InitialProfile = {
  displayName?: string | null;
  tagline?: string | null;
  location?: string | null;
  website?: string | null;
  bio?: string | null;

  links?: Array<{ label: string; url: string }> | null;

  legalName?: string | null;
  entityType?: "Business" | "Local Service" | "Organization" | "Creator / Person" | null;

  serviceArea?: string[] | null;
  foundedYear?: number | null;
  teamSize?: number | null;
  languages?: string[] | null;
  pricingModel?: "Free" | "Subscription" | "One-time" | "Custom" | null;
  hours?: string | null;

  certifications?: string | null;
  press?: Array<{ title: string; url: string }> | null;

  logoUrl?: string | null;
  imageUrls?: string[] | null;

  handles?: Record<string, string | undefined> | null;

  slug?: string | null;
} | null;

export default async function DashboardPage() {
  // make absolutely sure nothing throws (we render a friendly fallback instead)
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      redirect("/login?reason=signin-required");
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    if (!user) {
      redirect("/login?error=no-user");
    }

    const profile = await prisma.profile.findUnique({
      where: { userId: user.id },
    });

    const initial: InitialProfile = profile
      ? {
          displayName: profile.displayName ?? null,
          legalName: profile.legalName ?? null,
          entityType: (profile.entityType as any) ?? null,
          tagline: profile.tagline ?? null,
          bio: profile.bio ?? null,

          website: profile.website ?? null,
          location: profile.location ?? null,
          serviceArea: (profile.serviceArea as any) ?? [],

          foundedYear: profile.foundedYear ?? null,
          teamSize: profile.teamSize ?? null,
          languages: (profile.languages as any) ?? [],
          pricingModel: (profile.pricingModel as any) ?? null,
          hours: profile.hours ?? null,

          certifications: profile.certifications ?? null,
          press: (profile.press as any) ?? [],

          logoUrl: profile.logoUrl ?? null,
          imageUrls: (profile.imageUrls as any) ?? [],

          handles: (profile.handles as any) ?? {},
          links: (profile.links as any) ?? [],

          slug: profile.slug ?? null,
        }
      : null;

    return (
      <div className="container py-8">
        <h1 className="text-2xl font-semibold mb-6">Your AI Profile</h1>
        {/* Server ➜ Client boundary */}
        <ProfileEditor initial={initial} />
      </div>
    );
  } catch (err) {
    console.error("[/dashboard] server error", err);
    // Render a non-throwing fallback so you don’t get the generic “Digest” page
    return (
      <div className="container py-12">
        <h1 className="text-2xl font-semibold mb-4">Something went wrong</h1>
        <p className="text-gray-600 mb-6">
          We couldn’t load your dashboard. Try refreshing the page. If the issue persists,
          sign out and back in.
        </p>
        <div className="flex gap-3">
          <a className="px-4 py-2 rounded-lg border" href="/dashboard">Refresh</a>
          <a className="px-4 py-2 rounded-lg border" href="/login">Go to sign in</a>
        </div>
      </div>
    );
  }
}
