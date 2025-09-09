// app/dashboard/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import ProfileEditor from "@/components/ProfileEditor";
import { toKebab } from "@/lib/slug";

/** Keep in sync with /app/api/profile/ensure-unique-slug/route.ts */
const RESERVED = new Set([
  "admin","api","app","auth","dashboard","login","logout","sign-in","sign-up",
  "pricing","privacy","terms","faq","cancel","success","audit","disputes",
  "p","profile","profiles","user","users","me","settings","static","_next"
]);

async function ensureUniqueSlug(base: string) {
  const root0 = toKebab(base) || "user";
  const root = RESERVED.has(root0) ? `${root0}-1` : root0;

  let i = 0;
  while (true) {
    const candidate = i === 0 ? root : `${root}-${i}`;
    const taken = await prisma.profile.findUnique({ where: { slug: candidate } });
    if (!taken) return candidate;
    i++;
  }
}

// Narrow helpers for coercing Prisma JsonValue -> concrete shapes the client expects
const asArray = <T,>(v: any): T[] => (Array.isArray(v) ? (v as T[]) : []);
const asObject = <T extends object>(v: any): T => ((v && typeof v === "object") ? (v as T) : ({} as T));

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email! },
    select: { id: true, name: true, email: true },
  });
  if (!user) redirect("/login");

  // Get/create profile and guarantee there is a slug
  let profile = await prisma.profile.findUnique({ where: { userId: user.id } });

  if (!profile) {
    const base = user.name || user.email!.split("@")[0] || "user";
    const slug = await ensureUniqueSlug(base);
    profile = await prisma.profile.create({
      data: {
        userId: user.id,
        displayName: user.name ?? null,
        slug,
      },
    });
  } else if (!profile.slug) {
    const base = profile.displayName || user.name || user.email!.split("@")[0] || "user";
    const slug = await ensureUniqueSlug(base);
    profile = await prisma.profile.update({ where: { userId: user.id }, data: { slug } });
  }

  // Convert Prisma row into the "initial" shape ProfileEditor expects
  const clientInitial = {
    // identity
    displayName: profile.displayName,
    legalName: profile.legalName,
    entityType: profile.entityType as any,

    // story
    tagline: profile.tagline,
    bio: profile.bio,

    // anchors
    website: profile.website,
    location: profile.location,
    serviceArea: asArray<string>(profile.serviceArea),

    // trust
    foundedYear: profile.foundedYear,
    teamSize: profile.teamSize,
    languages: asArray<string>(profile.languages),
    pricingModel: profile.pricingModel as any,
    hours: profile.hours,

    certifications: profile.certifications,
    press: asArray<{ title: string; url: string }>(profile.press),

    // branding
    logoUrl: profile.logoUrl,
    imageUrls: asArray<string>(profile.imageUrls),

    // platforms & links
    handles: asObject<Record<string, string>>(profile.handles),
    links: asArray<{ label: string; url: string }>(profile.links),

    // public slug used by the editor for copy/redirect
    slug: profile.slug,
  };

  return (
    <div className="container py-8">
      <h1 className="text-2xl font-semibold mb-6">Your AI Profile</h1>
      {/* Server -> Client boundary */}
      <ProfileEditor initial={clientInitial as any} />
    </div>
  );
}
