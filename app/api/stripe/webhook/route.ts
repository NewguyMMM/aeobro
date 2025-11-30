// app/api/stripe/webhook/route.ts
// ✅ Updated: 2025-11-30 07:20 ET
// - LITE is baseline fallback plan
// - Map plan from Stripe price IDs (Lite/Plus/Pro/Business/Enterprise)
// - Extra logging so we can debug price → plan mapping in Vercel logs

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
    console.warn(
      "[stripe webhook] Unknown priceId, cannot map to plan:",
      priceId
    );
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
    select: { id: true, email: true },
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
    });
  }

  // 2) Fallback: retrieve from Stripe and match by email
  const retrieved = (await stripe.customers.retrieve(
    customerId
  )) as Stripe.Customer | Stripe.DeletedCustomer;

  if (isLiveCustomer(retrieved) && retrieved.email) {
    const byEmail = await prisma.user.findUnique({
      where: { email: retrieved.email },
      select: { id: true, email: true },
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

        await upsertUserFromCustomerId(customerId ?? "", {
          stripeSubscriptionId: subscriptionId ?? undefined,
          plan: mappedPlan, // if undefined, leave existing plan as-is
          planStatus: mappedPlan ? "active" : undefined,
          currentPeriodEnd: undefined,
        });

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

        const activeStatuses = ["trialing", "active", "past_due"] as const;
        const isActive = activeStatuses.includes(sub.status as any);

        // If we can map the price and the sub is active-ish, use that plan.
        // Otherwise fall back to LITE as the baseline.
        const plan: DbPlan = mappedPlan && isActive ? mappedPlan : "LITE";

        let currentPeriodEnd: Date | null = null;
        if (sub.current_period_end) {
          currentPeriodEnd = new Date(sub.current_period_end * 1000);
        }

        await upsertUserFromCustomerId(sub.customer as string, {
          stripeSubscriptionId: sub.id,
          plan,
          planStatus: sub.status,
          currentPeriodEnd,
        });
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

        await upsertUserFromCustomerId(customerId, {
          stripeSubscriptionId: subscriptionId ?? undefined,
          // Only set plan if we can map from price ID.
          plan: mappedPlan ?? undefined,
          planStatus: "active",
          currentPeriodEnd,
        });

        break;
      }

      /* ----------------------- customer.subscription.deleted -------------- */
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        console.log(
          "[stripe webhook] subscription deleted, downgrading to LITE. sub.id:",
          sub.id
        );
        await upsertUserFromCustomerId(sub.customer as string, {
          stripeSubscriptionId: null,
          plan: "LITE",
          planStatus: "canceled",
          currentPeriodEnd: null,
        });
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
