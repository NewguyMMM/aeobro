import type { Plan } from "@prisma/client";

export const PLANS = {
  FREE: {
    label: "Free",
    caps: { links: 3, images: 1, faqItems: 0, services: 0, revisions: 0, locations: 0 },
    features: { jsonLdPerson:true, jsonLdOrgLocal:false, faqMarkup:false, serviceMarkup:false, changeHistory:false,
                multiLocation:0, teamSeats:0, bulkImport:false, webhooks:false, analytics:false },
  },
  LITE: {
    label: "Lite",
    caps: { links: 5, images: 2, faqItems: 0, services: 0, revisions: 0, locations: 0 },
    features: { jsonLdPerson:true, jsonLdOrgLocal:false, faqMarkup:false, serviceMarkup:false, changeHistory:false,
                multiLocation:0, teamSeats:0, bulkImport:false, webhooks:false, analytics:false },
  },
  PRO: {
    label: "Pro",
    caps: { links:10, images:6, faqItems:10, services:10, revisions:20, locations:0 },
    features: { jsonLdPerson:true, jsonLdOrgLocal:true, faqMarkup:true, serviceMarkup:true, changeHistory:true,
                multiLocation:0, teamSeats:0, bulkImport:false, webhooks:false, analytics:false },
  },
  BUSINESS: {
    label: "Business",
    caps: { links:50, images:30, faqItems:50, services:50, revisions:200, locations:10 },
    features: { jsonLdPerson:true, jsonLdOrgLocal:true, faqMarkup:true, serviceMarkup:true, changeHistory:true,
                multiLocation:10, teamSeats:3, bulkImport:true, webhooks:true, analytics:true },
  },
} as const;

export type PlanKey = keyof typeof PLANS;

export function requirePlan(userPlan: Plan, needed: PlanKey) {
  const order: PlanKey[] = ["FREE", "LITE", "PRO", "BUSINESS"];
  return order.indexOf(userPlan) >= order.indexOf(needed);
}
export function getCap(plan: Plan, key: keyof typeof PLANS.FREE.caps) {
  return PLANS[plan].caps[key];
}
export function hasFeature(plan: Plan, key: keyof typeof PLANS.FREE.features) {
  return Boolean(PLANS[plan].features[key]);
}
