// app/dashboard/page.tsx
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import ProfileEditor from "@/components/ProfileEditor";

export const dynamic = "force-dynamic"; // ensure fresh data

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    redirect("/login?reason=signin-required");
  }

  // Resolve user id
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!user) {
    redirect("/login?error=no-user");
  }

  const profile = await prisma.profile.findUnique({
    where: { userId: user!.id },
  });

  // Shape everything into plain JSON that ProfileEditor expects
  const initial =
    profile
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
}
