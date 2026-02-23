// app/api/stripe/webhook/route.ts
// ✅ Updated: 2026-02-23 07:22 ET
// Policy alignment:
// - Upgrade immediate + prorated charge now
// - If payment fails → do NOT grant Plus entitlement
// - past_due → NOT entitled to Plus, but do NOT unpublish (Stripe retries)
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

  await prisma.user.update({
    where: { id: userId },
    data: {
      subscriptionLapsedAt: now,
      subscriptionReactivatedAt: null,
    },
  });

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

  await prisma.user.update({
    where: { id: userId },
    data: {
      subscriptionLapsedAt: null,
      subscriptionReactivatedAt: now,
    },
  });

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
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = session.customer as string | undefined;
        const subscriptionId = session.subscription as string | undefined;

        let mappedPlan: DbPlan | undefined;

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

        const safeSubId = await validateSubscriptionIdInThisMode(subscriptionId ?? null);

        const updated = await upsertUserFromCustomerId(customerId ?? "", {
          stripeSubscriptionId: safeSubId ?? undefined,
          plan: mappedPlan,
          planStatus: mappedPlan ? "active" : undefined,
          currentPeriodEnd: undefined,
        });

        if (updated?.id && updated.planStatus === "active") {
          await applySubscriptionReactivationEffects(updated.id);
        }

        break;
      }

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

        const safeSubId = await validateSubscriptionIdInThisMode(sub.id);

        const currentPeriodEnd = sub.current_period_end
          ? new Date(sub.current_period_end * 1000)
          : null;

        // ✅ Entitled = truly paid/trialing
        const isEntitled = sub.status === "active" || sub.status === "trialing";

        // ✅ If past_due, do NOT grant Plus. Keep them on LITE, but do NOT unpublish.
        const isPastDue = sub.status === "past_due";

        const plan: DbPlan = mappedPlan && isEntitled ? mappedPlan : "LITE";

        const updated = await upsertUserFromCustomerId(sub.customer as string, {
          stripeSubscriptionId: safeSubId,
          plan,
          planStatus: sub.status,
          currentPeriodEnd,
        });

        if (updated?.id) {
          if (isEntitled) {
            await applySubscriptionReactivationEffects(updated.id);
          } else if (isPastDue) {
            // Do nothing further: Stripe will retry payment.
            // User remains LITE (no Plus), but we do NOT unpublish the profile.
            console.warn("[stripe webhook] past_due: not entitled, not unpublishing", {
              userId: updated.id,
            });
          } else {
            await applySubscriptionLapseEffects(updated.id);
          }
        }

        break;
      }

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

        const safeSubId = await validateSubscriptionIdInThisMode(subscriptionId ?? null);

        const updated = await upsertUserFromCustomerId(customerId, {
          stripeSubscriptionId: safeSubId ?? undefined,
          plan: mappedPlan ?? undefined,
          planStatus: "active",
          currentPeriodEnd,
        });

        if (updated?.id) {
          await applySubscriptionReactivationEffects(updated.id);
        }

        break;
      }

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

        // Mark status; do NOT unpublish here.
        await upsertUserFromCustomerId(customerId, {
          planStatus: "past_due",
        });

        break;
      }

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
