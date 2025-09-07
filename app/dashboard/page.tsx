// app/dashboard/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import dynamic from "next/dynamic";

// Client components (SSR disabled)
const ProfileEditor = dynamic(() => import("@/components/ProfileEditor"), { ssr: false });
const CancelSubscriptionButton = dynamic(
  () => import("@/components/CancelSubscriptionButton"),
  { ssr: false }
);

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    redirect("/login");
  }

  // Look up the signed-in user and their profile
  const user = await prisma.user.findUnique({
    where: { email: session.user!.email! },
    select: { id: true, email: true },
  });
  if (!user) {
    redirect("/login");
  }

  const profile = await prisma.profile.findUnique({
    where: { userId: user.id },
  });

  return (
    <div className="container mx-auto px-4 py-12">
      <header className="mb-10">
        <h1 className="text-3xl font-bold">Your AI Profile</h1>
      </header>

      <p className="text-gray-600 mb-8">
        Signed in as <strong>{user.email}</strong>
      </p>

      <section className="rounded-2xl border p-8 bg-white shadow-sm">
        <ProfileEditor initial={profile as any} />
      </section>

      {/* Billing actions */}
      <section className="mt-10">
        <CancelSubscriptionButton />
      </section>
    </div>
  );
}
