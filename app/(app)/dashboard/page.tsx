// app/(app)/dashboard/page.tsx
// 📅 Updated: 2025-10-27 09:28 PM ET

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

import UnverifiedBanner from "@/components/UnverifiedBanner";
import ProfileEditor from "@/components/ProfileEditor";

export const dynamic = "force-dynamic";

/**
 * Dashboard page
 * - Redirects to sign-in if unauthenticated
 * - Resolves user via session.user.email (no reliance on user.id typing)
 * - Loads the user’s Profile
 * - Displays UnverifiedBanner if status === "UNVERIFIED"
 * - Renders ProfileEditor underneath
 */
export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;

  if (!email) {
    redirect("/signin");
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (!user?.id) {
    redirect("/signin");
  }

  const profile = await prisma.profile.findUnique({
    where: { userId: user.id },
  });

  if (!profile) {
    // No profile yet? Keep existing behavior and send them to the editor/onboarding flow
    redirect("/dashboard/editor");
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      {/* 🔶 Always-visible banner for unverified users */}
      <UnverifiedBanner status={profile.verificationStatus as any} />

      {/* Main profile editor */}
      <ProfileEditor profile={profile} />
    </div>
  );
}
