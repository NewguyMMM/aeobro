// app/dashboard/page.tsx
export const runtime = "nodejs";          // Prisma/NextAuth need Node runtime
export const dynamic = "force-dynamic";   // don't attempt to pre-render

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import ProfileEditor from "@/components/ProfileEditor";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    redirect("/login?reason=signin-required");
  }

  // Minimal server-side lookup: only to build the public view link
  // Keeps ProfileEditor behavior the same (it still fetches /api/profile itself)
  let publicHref: string | null = null;

  try {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email! },
      select: { id: true },
    });

    if (user?.id) {
      const profile = await prisma.profile.findUnique({
        where: { userId: user.id },
        select: { id: true, slug: true }, // slug optional; safe select
      });

      if (profile?.id) {
        publicHref = profile.slug ? `/p/${profile.slug}` : `/profile/${profile.id}`;
      }
    }
  } catch (err) {
    // Swallow errors here to avoid blocking the dashboard; link just won't render
    // You can add logging if desired
  }

  return (
    <div className="container py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Your AI Profile</h1>

        {publicHref && (
          <Link
            href={publicHref}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-blue-600 hover:underline"
          >
            View public profile
          </Link>
        )}
      </div>

      {/* Let the client component fetch /api/profile itself */}
      <ProfileEditor initial={null} />
    </div>
  );
}
