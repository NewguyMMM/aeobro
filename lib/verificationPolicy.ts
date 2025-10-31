// lib/verificationPolicy.ts
// ✅ Updated: 2025-10-31 08:02 ET
import { prisma } from "@/lib/prisma";

export function isDomainOrPlatformVerified(status?: string | null) {
  return status === "DOMAIN_VERIFIED" || status === "PLATFORM_VERIFIED";
}

export async function loadProfileWithVerification(slug: string) {
  return prisma.profile.findUnique({
    where: { slug },
    include: {
      platformAccounts: { where: { status: "VERIFIED" }, select: { id: true, provider: true, url: true } },
    },
  });
}

/** Syndication is allowed if:
 *  - profile.verificationStatus is DOMAIN_VERIFIED or PLATFORM_VERIFIED
 *  - (Optional plan gate) user.plan ∈ { LITE, PRO, BUSINESS } and planStatus === "active"
 */
export function isSyndicationAllowed(profile: {
  verificationStatus?: string | null;
  user?: { plan?: string | null; planStatus?: string | null } | null;
}, opts?: { enforcePlan?: boolean }) {
  const okVerification = isDomainOrPlatformVerified(profile?.verificationStatus);
  if (!opts?.enforcePlan) return okVerification;

  const planOk = ["LITE", "PRO", "BUSINESS"].includes(profile?.user?.plan ?? "");
  const planActive = profile?.user?.planStatus === "active";
  return okVerification && planOk && planActive;
}

/** Badge: show when at least one PlatformAccount is VERIFIED or status is PLATFORM_VERIFIED */
export function hasPlatformBadge(profile: {
  verificationStatus?: string | null;
  platformAccounts?: Array<{ /* id */ }> | null;
}) {
  return (
    profile?.verificationStatus === "PLATFORM_VERIFIED" ||
    (profile?.platformAccounts && profile.platformAccounts.length > 0)
  );
}
