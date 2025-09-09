// app/dashboard/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import ProfileEditor from "@/components/ProfileEditor";
import { toKebab } from "@/lib/slug";

// System-reserved slugs
const RESERVED = new Set([
  "admin","api","app","auth","dashboard","login","logout","sign-in","sign-up",
  "pricing","privacy","terms","faq","cancel","success","audit","disputes",
  "p","profile","profiles","user","users","me","settings","static","_next"
]);

async function ensureUniqueSlug(baseRaw: string) {
  const base0 = toKebab(baseRaw || "");
  const root = RESERVED.has(base0) || !base0 ? (base0 ? `${base0}-1` : "user") : base0;

  let i = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const candidate = i === 0 ? root : `${root}-${i}`;
    const taken = await prisma.profile.findUnique({ where: { slug: candidate } });
    if (!taken) return candidate;
    i++;
  }
}

// helpers to coerce Prisma JSON fields safely into client shapes
const asArray = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const asObject = <T extends object>(v: unknown): T =>
  v && typeof v === "object" ? (v as T) : ({} as T);

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email! },
    select: { id: true, name: true, email: true },
  });
  if (!user) redirect("/login");

  // Create profile if absent; ensure it has a slug
  let profile = await prisma.profile.findUnique({ where: { userId: user.id } });

  if (!profile) {
    const base = user.name || user.email!.split("@")[0] || "user";
    const slug = await ensureUniqueSlug(base);
    profile = await prisma.profile.create({
      data: { userId: user.id, displayName: user.name ?? null, slug },
    });
  } else if (!profile.slug) {
    const base = profile.displayName || user.name || user.email!.split("@")[0] || "user";
    const slug = await ensureUniqueSlug(base);
    profile = await prisma.profile.update({ where: { userId: user.id }, data: { slug } });
  }

  // Shape data for the client component
  const clientInitial = {
    displayName: profile.displayName,
    legalName: profile.legalName,
    entityType: profile.entityType as any,
    tagline: profile.tagline,
    bio: profile.bio,
    website: profile.website,
    location: profile.location,
    serviceArea: asArray<string>(profile.serviceArea),
    foundedYear: profile.foundedYear,
    teamSize: profile.teamSize,
    languages: asArray<string>(profile.languages),
    pricingModel: profile.pricingModel as any,
    hours: profile.hours,
    certifications: profile.certifications,
    press: asArray<{ title: string; url: string }>(profile.press),
    logoUrl: profile.logoUrl,
    imageUrls: asArray<string>(profile.imageUrls),
    handles: asObject<Record<string, string>>(profile.handles),
    links: asArray<{ label: string; url: string }>(profile.links),
    slug: profile.slug,
  };

  return (
    <div className="container py-8">
      <h1 className="text-2xl font-semibold mb-6">Your AI Profile</h1>
      {/* Server → Client boundary */}
      <ProfileEditor initial={clientInitial as any} />
    </div>
  );
}
