// app/dashboard/page.tsx
export const runtime = "nodejs";          // Prisma/NextAuth need Node runtime
export const dynamic = "force-dynamic";   // don't attempt to pre-render

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import ProfileEditor from "@/components/ProfileEditor";
import PublicProfileLink from "@/components/PublicProfileLink";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    redirect("/login?reason=signin-required");
  }

  return (
    <div className="container py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Your AI Profile</h1>
        {/* Client-side; shows once /api/profile returns id/slug (and isPublished if you gate it) */}
        <PublicProfileLink />
      </div>

      {/* Let the client component fetch /api/profile itself */}
      <ProfileEditor initial={null} />
    </div>
  );
}
