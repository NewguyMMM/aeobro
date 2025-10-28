// app/(app)/dashboard/page.tsx
// 📅 Updated: 2025-10-27 09:36 PM ET

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

import UnverifiedBanner from "@/components/UnverifiedBanner";
import ProfileEditor from "@/components/ProfileEditor";

export const dynamic = "force-dynamic";

// Simple JSON coercers to satisfy the UI's expected types
function asArray<T = any>(v: unknown, fallback: T[] = []): T[] {
  if (!v) return fallback;
  if (Array.isArray(v)) return v as T[];
  try {
    const parsed = typeof v === "string" ? JSON.parse(v) : v;
    return Array.isArray(parsed) ? (parsed as T[]) : fallback;
  } catch {
    return fallback;
  }
}

function asObject<T extends object = Record<string, any>>(v: unknown, fallback: T = {} as T): T {
  if (!v) return fallback;
  if (typeof v === "object" && v !== null && !Array.isArray(v)) return v as T;
  try {
    const parsed = typeof v === "string" ? JSON.parse(v) : v;
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? (parsed as T) : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Dashboard page
 * - Redirects to sign-in if unauthenticated
 * - Resolves user via session.user.email
 * - Loads Prisma Profile, maps JSON fields to the UI shape expected by <ProfileEditor initial={...}>
 * - Shows UnverifiedBanner
 */
export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) redirect("/signin");

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!user?.id) redirect("/signin");

  const db = await prisma.profile.findUnique({
    where: { userId: user.id },
  });

  if (!db) {
    // Keep current behavior if profile hasn't been created yet
    redirect("/dashboard/editor");
  }

  // --- Map Prisma Profile -> UI ProfileEditor expected shape ---
  // ProfileEditor (from your pasted code) expects arrays/objects (not Prisma JsonValue)
  const uiProfile = {
    // server identity
    id: db.id,

    // Core identity
    displayName: db.displayName ?? null,
    legalName: db.legalName ?? null,
    entityType: db.entityType ?? null,

    // Story
    tagline: db.tagline ?? null,
    bio: db.bio ?? null,

    // Anchors
    website: db.website ?? null,
    location: db.location ?? null,
    serviceArea: asArray<string>(db.serviceArea, []),

    // Trust & authority
    foundedYear: db.foundedYear ?? null,
    teamSize: db.teamSize ?? null,
    languages: asArray<string>(db.languages, []),
    pricingModel: db.pricingModel ?? null,
    hours: db.hours ?? null,
    certifications: db.certifications ?? null,

    // Media & authority
    press: asArray<{ title: string; url: string }>(db.press, []),
    logoUrl: db.logoUrl ?? null,
    imageUrls: asArray<string>(db.imageUrls, []),

    // Platforms & links
    // Your newer code uses `handles: Json?`; older editor types had explicit fields.
    // Map the JSON object if present; the editor will read the shape it defined.
    handles: asObject<Record<string, string | undefined>>(db.handles, {}),
    links: asArray<{ label: string; url: string }>(db.links, []),

    // Verification (editor might display or ignore)
    verificationStatus: db.verificationStatus,

    // Slug (if editor needs it)
    slug: db.slug,
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      {/* 🔶 Always-visible banner for unverified users */}
      <UnverifiedBanner status={db.verificationStatus as any} />

      {/* Main profile editor expects `initial` prop shaped for its UI types */}
      <ProfileEditor initial={uiProfile as any} />
    </div>
  );
}
