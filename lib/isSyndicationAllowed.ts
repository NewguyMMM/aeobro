// lib/isSyndicationAllowed.ts
// ✅ Updated: 2025-11-01 09:02 ET
// Central gate for profile export/syndication eligibility.

export type VerificationStatus = "UNVERIFIED" | "PLATFORM_VERIFIED" | "DOMAIN_VERIFIED";
export type Plan = "Lite" | "Plus" | "Pro" | "Business" | "Enterprise" | null | undefined;

export type SyndicationOptions = {
  /** If true, being on an eligible paid plan is sufficient to allow export. Default: true */
  enforcePlan?: boolean;
  /**
   * If true, PLATFORM_VERIFIED is enough (besides DOMAIN_VERIFIED) for read-only JSON-LD.
   * Default: true
   */
  allowPlatformVerified?: boolean;
  /**
   * Optional hint for future nuance. For now:
   * - "schema": allow PLATFORM_VERIFIED (Lite OK)
   * - "external": typically stricter (you can pass allowPlatformVerified: false when using externally)
   */
  feedKind?: "schema" | "external";
};

const PAID_PLANS: ReadonlySet<Exclude<Plan, "Lite" | null | undefined>> = new Set([
  "Plus",
  "Pro",
  "Business",
  "Enterprise",
]);

type MinimalProfile = {
  verificationStatus?: VerificationStatus | null;
  plan?: Plan;
};

export function isSyndicationAllowed(
  profile: MinimalProfile,
  opts: SyndicationOptions = {}
): {
  allowed: boolean;
  reason?: string;
  require?: {
    anyOf: Array<"DOMAIN_VERIFIED" | "PLATFORM_VERIFIED" | "PAID_PLAN">;
    paidPlans: string[];
  };
} {
  const status = (profile.verificationStatus || "UNVERIFIED") as VerificationStatus;
  const plan = profile.plan ?? null;

  const enforcePlan = opts.enforcePlan ?? true;
  const allowPlatformVerified = opts.allowPlatformVerified ?? true;

  const hasDomain = status === "DOMAIN_VERIFIED";
  const hasPlatform = status === "PLATFORM_VERIFIED";
  const onPaidPlan = plan ? PAID_PLANS.has(plan as any) : false;

  // Allow if:
  // 1) DOMAIN_VERIFIED always allowed
  // 2) PLATFORM_VERIFIED allowed if allowPlatformVerified === true
  // 3) If enforcePlan === true, any paid plan is allowed
  const allowed =
    hasDomain ||
    (allowPlatformVerified && hasPlatform) ||
    (enforcePlan && onPaidPlan);

  if (allowed) return { allowed: true };

  return {
    allowed: false,
    reason:
      "Syndication disabled. Verify your domain or connect a platform (or activate an eligible plan).",
    require: {
      anyOf: ["DOMAIN_VERIFIED", "PLATFORM_VERIFIED", "PAID_PLAN"],
      paidPlans: Array.from(PAID_PLANS.values()),
    },
  };
}
