// app/api/stripe/webhook/route.ts
// ✅ Updated: 2026-02-23 07:16 ET
// Fix: Portal policy alignment:
// - Upgrade immediate + prorated charge now
// - If payment fails → do NOT grant Plus entitlement
// Change: Do NOT treat "past_due" as entitled
// Add: invoice.payment_failed handler to mark planStatus as past_due (without unpublishing immediately)
// Keeps: wrong-mode protection, lapse/unpublish rules, 90-day retention, reactivation, mapping

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import type { Plan as DbPlan } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ---------------------------- Env + Stripe client --------------------------- */

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY as string;
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET as string;

if (!STRIPE_SECRET_KEY) {
  throw new Error("Missing STRIPE_SECRET_KEY in environment");
}
if (!WEBHOOK_SECRET) {
  throw new Error("Missing STRIPE_WEBHOOK_SECRET in environment");
}

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

/* -------------------- Price ID → Plan mapping (from env) ------------------- */

const PRICE_TO_PLAN: Record<string, DbPlan> = {};
const pricePlanPairs: Array<[string | undefined | null, DbPlan]> = [
  [process.env.NEXT_PUBLIC_STRIPE_PRICE_LITE, "LITE"],
  [process.env.NEXT_PUBLIC_STRIPE_PRICE_PLUS, "PLUS"],
  [process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO, "PRO"],
  [process.env.NEXT_PUBLIC_STRIPE_PRICE_BUSINESS, "BUSINESS"],
  [process.env.NEXT_PUBLIC_STRIPE_PRICE_ENTERPRISE, "ENTERPRISE"],
];

for (const [priceId, plan] of pricePlanPairs) {
  if (priceId) {
    PRICE_TO_PLAN[priceId] = plan;
  }
}

function mapPriceToPlan(priceId?: string | null): DbPlan | undefined {
  if (!priceId) return undefined;
  const plan = PRICE_TO_PLAN[priceId];
  if (!plan) {
    console.warn("[stripe webhook] Unknown priceId, cannot map to plan:", priceId);
  } else {
    console.log("[stripe webhook] Mapped priceId → plan:", priceId, "→", plan);
  }
  return plan;
}

/* --------------------------- Helper: live customer -------------------------- */

function isLiveCustomer(
  c: Stripe.Customer | Stripe.DeletedCustomer
): c is Stripe.Customer {
  return !("deleted" in (c as any) && (c as any).deleted === true);
}

/* -------- Helper: prevent wrong-mode subscriptionId poisoning of DB ---------- */

function isStripeMissingResource(err: any) {
  const msg = (err?.message || "").toLowerCase();
  return (
    err?.type === "StripeInvalidRequestError" &&
    (err?.code === "resource_missing" || msg.includes("no such"))
  );
}

/**
 * Validate a subscriptionId exists in the current Stripe mode (as determined by STRIPE_SECRET_KEY).
 * - Returns the subscriptionId if valid
 * - Returns null if missing (wrong mode / deleted / invalid)
 * - Throws for non-"missing resource" Stripe errors
 */
async function validateSubscriptionIdInThisMode(
  subscriptionId?: string | null
): Promise<string | null> {
  if (!subscriptionId) return null;
  try {
    await stripe.subscriptions.retrieve(subscriptionId);
    return subscriptionId;
  } catch (err: any) {
    if (isStripeMissingResource(err)) {
      console.warn(
        "[stripe webhook] subscriptionId invalid in current Stripe mode, skipping store:",
        subscriptionId
      );
      return null;
    }
    throw err;
  }
}

/* ------------------------ Lapse/Reactivate helpers ------------------------- */

const DAYS_90_MS = 90 * 24 * 60 * 60 * 1000;

async function applySubscriptionLapseEffects(
  userId: string,
  reason = "SUBSCRIPTION_LAPSED"
) {
  const now = new Date();
  const retentionUntil = new Date(now.getTime() + DAYS_90_MS);

  console.log(
    "[stripe webhook] Applying lapse effects for user:",
    userId,
    "retentionUntil:",
    retentionUntil.toISOString()
  );

  // 1) Anchor the lapse timestamp (only set once)
  await prisma.user.update({
    where: { id: userId },
    data: {
      subscriptionLapsedAt: now,
      subscriptionReactivatedAt: null,
    },
  });

  // 2) Unpublish profile immediately (404 => effectively not crawlable)
  await prisma.profile.updateMany({
    where: { userId },
    data: {
      visibility: "UNPUBLISHED",
      unpublishedAt: now,
      unpublishReason: reason as any,
      retentionUntil,
      deletedAt: null,
      deletionJobLockedAt: null,
    },
  });
}

async function applySubscriptionReactivationEffects(userId: string) {
  const now = new Date();

  console.log("[stripe webhook] Applying reactivation effects for user:", userId);

  // Clear lapse anchor
  await prisma.user.update({
    where: { id: userId },
    data: {
      subscriptionLapsedAt: null,
      subscriptionReactivatedAt: now,
    },
  });

  // Republish ONLY if it was unpublished due to lapse
  await prisma.profile.updateMany({
    where: {
      userId,
      visibility: "UNPUBLISHED",
      unpublishReason: "SUBSCRIPTION_LAPSED" as any,
    },
    data: {
      visibility: "PUBLIC",
      unpublishedAt: null,
      unpublishReason: "NONE" as any,
      retentionUntil: null,
      deletedAt: null,
      deletionJobLockedAt: null,
    },
  });
}

/* ------------------------- Helper: upsert user record ---------------------- */

async function upsertUserFromCustomerId(
  customerId: string,
  fields: {
    stripeSubscriptionId?: string | null;
    plan?: DbPlan;
    planStatus?: string;
    currentPeriodEnd?: Date | null;
  }
) {
  if (!customerId) return null;

  // 1) Try by stripeCustomerId
  const byCustomer = await prisma.user.findFirst({
    where: { stripeCustomerId: customerId },
    select: { id: true, email: true, subscriptionLapsedAt: true },
  });
  if (byCustomer) {
    console.log(
      "[stripe webhook] Updating user by stripeCustomerId:",
      customerId,
      "fields:",
      fields
    );
    return prisma.user.update({
      where: { id: byCustomer.id },
      data: fields,
      select: { id: true, plan: true, planStatus: true, subscriptionLapsedAt: true },
    });
  }

  // 2) Fallback: retrieve from Stripe and match by email
  const retrieved = (await stripe.customers.retrieve(
    customerId
  )) as Stripe.Customer | Stripe.DeletedCustomer;

  if (isLiveCustomer(retrieved) && retrieved.email) {
    const byEmail = await prisma.user.findUnique({
      where: { email: retrieved.email },
      select: { id: true, email: true, subscriptionLapsedAt: true },
    });
    if (byEmail) {
      console.log(
        "[stripe webhook] Updating user by email from Stripe customer:",
        retrieved.email,
        "fields:",
        fields
      );
      return prisma.user.update({
        where: { id: byEmail.id },
        data: {
          stripeCustomerId: customerId,
          ...fields,
        },
        select: { id: true, plan: true, planStatus: true, subscriptionLapsedAt: true },
      });
    }
  }

  console.warn(
    "[stripe webhook] No matching user for customerId, skipping update:",
    customerId
  );
  return null;
}

/* --------------------------------- Handler --------------------------------- */

export async function POST(req: Request) {
  let event: Stripe.Event;

  // Verify signature first
  try {
    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      console.error("❌ Missing stripe-signature header");
      return new NextResponse("Missing stripe-signature", { status: 400 });
    }
    const raw = await req.text();
    event = stripe.webhooks.constructEvent(raw, signature, WEBHOOK_SECRET);
  } catch (err: any) {
    console.error("❌ Invalid Stripe signature:", err?.message);
    return new NextResponse("Invalid signature", { status: 400 });
  }

  console.log("[stripe webhook] Received event:", event.type);

  try {
    switch (event.type) {
      /* -------------------- checkout.session.completed -------------------- */
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = session.customer as string | undefined;
        const subscriptionId = session.subscription as string | undefined;

        let mappedPlan: DbPlan | undefined;

        // We store price id in metadata.plan_price_id from the /checkout endpoint.
        const metaPriceId =
          typeof session.metadata?.plan_price_id === "string"
            ? session.metadata.plan_price_id.trim()
            : undefined;

        if (metaPriceId) {
          console.log(
            "[stripe webhook] checkout.session.completed metadata.plan_price_id:",
            metaPriceId
          );
          mappedPlan = mapPriceToPlan(metaPriceId);
        } else {
          console.warn(
            "[stripe webhook] checkout.session.completed has NO metadata.plan_price_id"
          );
        }

        // ✅ Prevent wrong-mode subscription poisoning
        const safeSubId = await validateSubscriptionIdInThisMode(subscriptionId ?? null);

        const updated = await upsertUserFromCustomerId(customerId ?? "", {
          stripeSubscriptionId: safeSubId ?? undefined,
          plan: mappedPlan, // if undefined, leave existing plan as-is
          planStatus: mappedPlan ? "active" : undefined,
          currentPeriodEnd: undefined,
        });

        // If this was a purchase/activation, treat as reactivation safety
        if (updated?.id && updated.planStatus === "active") {
          await applySubscriptionReactivationEffects(updated.id);
        }

        break;
      }

      /* --------------- customer.subscription.created/updated --------------- */
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;

        let priceId: string | undefined;
        if (sub.items?.data?.length) {
          priceId = sub.items.data[0].price?.id ?? undefined;
        }

        console.log(
          "[stripe webhook] subscription event:",
          event.type,
          "sub.id:",
          sub.id,
          "status:",
          sub.status,
          "priceId:",
          priceId
        );

        const mappedPlan = mapPriceToPlan(priceId);

        // ✅ Entitlement must match AEOBRO FAQ:
        // If payment fails and Stripe marks subscription as past_due, do NOT grant Plus.
        const entitlementStatuses = ["trialing", "active"] as const;
        const isEntitled = entitlementStatuses.includes(sub.status as any);

        // If we can map the price and the sub is entitled, use that plan.
        // Otherwise fall back to LITE as the baseline.
        const plan: DbPlan = mappedPlan && isEntitled ? mappedPlan : "LITE";

        let currentPeriodEnd: Date | null = null;
        if (sub.current_period_end) {
          currentPeriodEnd = new Date(sub.current_period_end * 1000);
        }

        // ✅ Prevent wrong-mode subscription poisoning
        const safeSubId = await validateSubscriptionIdInThisMode(sub.id);

        const updated = await upsertUserFromCustomerId(sub.customer as string, {
          stripeSubscriptionId: safeSubId, // string | null
          plan,
          planStatus: sub.status,
          currentPeriodEnd,
        });

        if (updated?.id) {
          if (isEntitled) {
            await applySubscriptionReactivationEffects(updated.id);
          } else {
            // For non-entitled statuses (canceled, unpaid, incomplete_expired, etc),
            // apply lapse effects (unpublish + retention).
            await applySubscriptionLapseEffects(updated.id);
          }
        }

        break;
      }

      /* ----------------------- invoice.payment_succeeded ------------------- */
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string | null;
        if (!customerId) break;

        let priceId: string | undefined;
        const firstLine = invoice.lines?.data?.[0];
        if (firstLine) {
          priceId = firstLine.price?.id ?? undefined;
        }

        console.log(
          "[stripe webhook] invoice.payment_succeeded invoice.id:",
          invoice.id,
          "priceId:",
          priceId
        );

        const mappedPlan = mapPriceToPlan(priceId);

        const subscriptionId =
          typeof invoice.subscription === "string"
            ? invoice.subscription
            : invoice.subscription?.id;

        const periodEndUnix = firstLine?.period?.end;
        const currentPeriodEnd = periodEndUnix
          ? new Date(periodEndUnix * 1000)
          : null;

        // ✅ Prevent wrong-mode subscription poisoning
        const safeSubId = await validateSubscriptionIdInThisMode(subscriptionId ?? null);

        const updated = await upsertUserFromCustomerId(customerId, {
          stripeSubscriptionId: safeSubId ?? undefined,
          // Only set plan if we can map from price ID.
          plan: mappedPlan ?? undefined,
          planStatus: "active",
          currentPeriodEnd,
        });

        if (updated?.id) {
          await applySubscriptionReactivationEffects(updated.id);
        }

        break;
      }

      /* ----------------------- invoice.payment_failed ---------------------- */
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string | null;
        if (!customerId) break;

        console.warn(
          "[stripe webhook] invoice.payment_failed invoice.id:",
          invoice.id,
          "billing_reason:",
          invoice.billing_reason,
          "attempt_count:",
          invoice.attempt_count
        );

        // Key behavior:
        // - Mark planStatus so the app can gate premium features.
        // - Do NOT unpublish immediately here; Stripe may retry.
        // - subscription.updated will ultimately drive lapse effects if it moves to a non-entitled state.
        await upsertUserFromCustomerId(customerId, {
          planStatus: "past_due",
        });

        break;
      }

      /* ----------------------- customer.subscription.deleted -------------- */
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        console.log(
          "[stripe webhook] subscription deleted, downgrading to LITE + unpublishing. sub.id:",
          sub.id
        );

        const updated = await upsertUserFromCustomerId(sub.customer as string, {
          stripeSubscriptionId: null,
          plan: "LITE",
          planStatus: "canceled",
          currentPeriodEnd: null,
        });

        if (updated?.id) {
          await applySubscriptionLapseEffects(updated.id);
        }
        break;
      }

      default: {
        // We ignore other events, but log them once in case we need them later.
        console.log("[stripe webhook] Ignoring event type:", event.type);
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error("❌ Webhook handler error:", err);
    return new NextResponse("Webhook handler error", { status: 500 });
  }
}
