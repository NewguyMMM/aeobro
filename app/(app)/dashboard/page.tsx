// app/(app)/dashboard/page.tsx
// 📅 Updated: 2025-11-05 06:00 ET

export const runtime = "nodejs";          // ensure Prisma-compatible runtime (Prisma needs Node)
export const dynamic = "force-dynamic";   // always render on server (no static cache)

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

import UnverifiedBanner from "@/components/UnverifiedBanner";
import ProfileEditor from "@/components/ProfileEditor";

/** Helpers to coerce JSON to the UI shapes ProfileEditor expects (must be serializable) */
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
  // --- 1) Session guard
  let session;
  try {
    session = await getServerSession(authOptions);
  } catch {
    redirect("/signin");
  }
  const email = session?.user?.email;
  if (!email) redirect("/signin");

  // --- 2) User lookup
  let userId: string | null = null;
  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    userId = user?.id ?? null;
  } catch {
    redirect("/signin");
  }
  if (!userId) redirect("/signin");

  // --- 3) Profile lookup
  let db: any = null;
  try {
    db = await prisma.profile.findUnique({
      where: { userId },
    });
  } catch {
    db = null;
  }

  // If there is no profile yet, render the editor with empty initial state
  const uiProfile = db
    ? {
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
        verificationStatus: db.verificationStatus ?? "UNVERIFIED",
        slug: db.slug ?? null,
      }
    : null;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      {/* Gentle nudge only (no embedded card) */}
      <UnverifiedBanner status={(uiProfile?.verificationStatus ?? "UNVERIFIED") as any} />

      {/* Editor renders everything, including the single Verify section at the bottom */}
      <ProfileEditor initial={uiProfile as any} />
    </div>
  );
}
