// app/(app)/dashboard/page.tsx
// 📅 Updated: 2025-10-27 09:46 PM ET

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

import UnverifiedBanner from "@/components/UnverifiedBanner";
import ProfileEditor from "@/components/ProfileEditor";

export const dynamic = "force-dynamic";
// (Optional) uncomment if you pin to Node runtime
// export const runtime = "nodejs";

/** Helpers to coerce JSON to the UI shapes ProfileEditor expects */
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
  if (!db) redirect("/dashboard/editor");

  const uiProfile = {
    id: db.id,
    displayName: db.displayName ?? null,
    legalName: db.legalName ?? null,
    entityType: db.entityType ?? null,
    tagline: db.tagline ?? null,
    bio: db.bio ?? null,
    website: db.website ?? null,
    location: db.location ?? null,
    serviceArea: asArray<string>(db.serviceArea, []),
    foundedYear: db.foundedYear ?? null,
    teamSize: db.teamSize ?? null,
    languages: asArray<string>(db.languages, []),
    pricingModel: db.pricingModel ?? null,
    hours: db.hours ?? null,
    certifications: db.certifications ?? null,
    press: asArray<{ title: string; url: string }>(db.press, []),
    logoUrl: db.logoUrl ?? null,
    imageUrls: asArray<string>(db.imageUrls, []),
    handles: asObject<Record<string, string | undefined>>(db.handles, {}),
    links: asArray<{ label: string; url: string }>(db.links, []),
    verificationStatus: db.verificationStatus,
    slug: db.slug,
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <UnverifiedBanner status={db.verificationStatus as any} />
      <ProfileEditor initial={uiProfile as any} />
    </div>
  );
}
