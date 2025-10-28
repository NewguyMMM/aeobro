// app/(app)/dashboard/page.tsx
// 📅 Updated: 2025-10-27 02:24 PM ET

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
 * - Loads the user’s Profile
 * - Displays UnverifiedBanner if status === "UNVERIFIED"
 * - Renders ProfileEditor underneath
 */
export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/signin");
  }

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
  });

  if (!profile) {
    // No profile yet? Redirect to editor or onboarding flow
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
