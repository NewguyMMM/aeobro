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
  // Probe until we find a free slug
  while (true) {
    const candidate = i === 0 ? root : `${root}-${i}`;
    const taken = await prisma.profile.findUnique({ where: { slug: candidate } });
    if (!taken) return candidate;
    i++;
  }
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email! },
    select: { id: true, name: true, email: true },
  });
  if (!user) {
    redirect("/login");
  }

  // Get or create profile
  let profile = await prisma.profile.findUnique({ where: { userId: user.id } });

  // First-time users: create with a valid, unique slug
  if (!profile) {
    const base = user.name || user.email!.split("@")[0] || "user";
    const slug = await ensureUniqueSlug(base);

    profile = await prisma.profile.create({
      data: {
        userId: user.id,
        displayName: user.name ?? null,
        slug, // required
      },
    });
  } else if (!profile.slug) {
    // Backfill slug if an older row exists without one
    const base =
      profile.displayName || user.name || user.email!.split("@")[0] || "user";
    const slug = await ensureUniqueSlug(base);
    profile = await prisma.profile.update({
      where: { userId: user.id },
      data: { slug },
    });
  }

  // Render the client editor with the server-fetched initial data
  return (
    <div className="container py-8">
      <h1 className="text-2xl font-semibold mb-6">Your AI Profile</h1>
      {/* Server -> Client boundary */}
      <ProfileEditor initial={profile} />
    </div>
  );
}
