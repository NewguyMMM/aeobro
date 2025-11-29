// lib/plan.ts
// 📅 Updated: 2025-11-29 05:50 ET

import type { Plan as DbPlan } from "@prisma/client";

/**
 * Define all plans in one place.
 * - Each plan has a label, a rank (for comparisons), caps, and features.
 * - Keep the caps/features keys consistent across plans so typings stay simple.
 *
 * Note: FREE is now a legacy alias of LITE. All fallbacks and UI should
 * treat “no plan” / “FREE” as LITE-level access.
 */
export const PLANS = {
  // 🔸 Legacy alias of LITE (same label, rank, caps, and features)
  FREE: {
    label: "Lite",
    rank: 1,
    caps: { links: 5, images: 2, faqItems: 0, services: 0, revisions: 0, locations: 0 },
    features: {
      jsonLdPerson: true,
      jsonLdOrgLocal: false,
      faqMarkup: false,
      serviceMarkup: false,
      changeHistory: false,
      multiLocation: 0,
      teamSeats: 0,
      bulkImport: false,
      webhooks: false,
      analytics: false,
    },
  },
  LITE: {
    label: "Lite",
    rank: 1,
    caps: { links: 5, images: 2, faqItems: 0, services: 0, revisions: 0, locations: 0 },
    features: {
      jsonLdPerson: true,
      jsonLdOrgLocal: false,
      faqMarkup: false,
      serviceMarkup: false,
      changeHistory: false,
      multiLocation: 0,
      teamSeats: 0,
      bulkImport: false,
      webhooks: false,
      analytics: false,
    },
  },
  PLUS: {
    label: "Plus",
    rank: 2,
    // Sensible middle ground between LITE and PRO
    caps: { links: 7, images: 4, faqItems: 5, services: 5, revisions: 10, locations: 0 },
    features: {
      jsonLdPerson: true,
      jsonLdOrgLocal: false, // keep org/local for PRO+ (per your gating strategy)
      faqMarkup: true,
      serviceMarkup: true,
      changeHistory: true,
      multiLocation: 0,
      teamSeats: 0,
      bulkImport: false,
      webhooks: false,
      analytics: false,
    },
  },
  PRO: {
    label: "Pro",
    rank: 3,
    caps: { links: 10, images: 6, faqItems: 10, services: 10, revisions: 20, locations: 0 },
    features: {
      jsonLdPerson: true,
      jsonLdOrgLocal: true,
      faqMarkup: true,
      serviceMarkup: true,
      changeHistory: true,
      multiLocation: 0,
      teamSeats: 0,
      bulkImport: false,
      webhooks: false,
      analytics: false,
    },
  },
  BUSINESS: {
    label: "Business",
    rank: 4,
    caps: { links: 50, images: 30, faqItems: 50, services: 50, revisions: 200, locations: 10 },
    features: {
      jsonLdPerson: true,
      jsonLdOrgLocal: true,
      faqMarkup: true,
      serviceMarkup: true,
      changeHistory: true,
      multiLocation: 10,
      teamSeats: 3,
      bulkImport: true,
      webhooks: true,
      analytics: true,
    },
  },
  ENTERPRISE: {
    label: "Enterprise",
    rank: 5,
    // Mirror Business but leave room to expand
    caps: { links: 100, images: 60, faqItems: 200, services: 200, revisions: 1000, locations: 100 },
    features: {
      jsonLdPerson: true,
      jsonLdOrgLocal: true,
      faqMarkup: true,
      serviceMarkup: true,
      changeHistory: true,
      multiLocation: 100,
      teamSeats: 50,
      bulkImport: true,
      webhooks: true,
      analytics: true,
    },
  },
} as const;

export type PlanKey = keyof typeof PLANS;

/** Normalize any incoming plan (Prisma enum or string) to a valid PlanKey. */
function normalizePlan(p: DbPlan | PlanKey | string | null | undefined): PlanKey {
  const v = String(p ?? "").toUpperCase();

  // 🔸 Treat FREE as LITE in all logic
  if (v === "FREE") return "LITE";

  if (v in PLANS) return v as PlanKey;

  // Default baseline is now LITE (no exposed “Free tier”)
  return "LITE";
}

/** Returns true if `userPlan` rank >= `needed` rank. */
export function requirePlan(userPlan: DbPlan | PlanKey, needed: PlanKey) {
  const up = normalizePlan(userPlan);
  const need = normalizePlan(needed);
  return PLANS[up].rank >= PLANS[need].rank;
}

/** Read a capability value from the plan’s caps map. */
export function getCap(
  plan: DbPlan | PlanKey,
  key: keyof typeof PLANS.LITE.caps
) {
  const pk = normalizePlan(plan);
  return PLANS[pk].caps[key];
}

/** Check whether a boolean/numbered feature is available on the plan. */
export function hasFeature(
  plan: DbPlan | PlanKey,
  key: keyof typeof PLANS.LITE.features
) {
  const pk = normalizePlan(plan);
  return Boolean(PLANS[pk].features[key]);
}

/** Optional helpers */
export function planLabel(plan: DbPlan | PlanKey) {
  return PLANS[normalizePlan(plan)].label;
}

export function planRank(plan: DbPlan | PlanKey) {
  return PLANS[normalizePlan(plan)].rank;
}
