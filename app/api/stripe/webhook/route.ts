// app/api/stripe/webhook/route.ts
// ✅ Updated: 2025-11-30 06:05 ET
// - Use LITE instead of FREE as fallback/downgrade plan
// - ALSO map plan on checkout.session.completed via metadata.plan_price_id

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import type { Plan as DbPlan } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Assert as string for TypeScript, then still runtime-check.
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

/**
 * Build a safe mapping: Stripe Price ID → Prisma Plan enum.
 * Only envs that are actually set get added (no empty-string keys).
 */
const PRICE_TO_PLAN: Record<string, DbPlan> = {};
const pricePlanPairs: Array<[string | undefined | null, DbPlan]> = [
  [process.env.NEXT_PUBLIC_STRIPE_PRICE_LITE, "LITE"],
  [process.env.NEXT_PUBLIC_STRIPE_PRICE_PLUS, "PLUS"],
  [process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO, "PRO"],
  [process.env.NEXT_PUBLIC_STRIPE_PRICE_BUSINESS, "BUSINESS"],
  // If/when you wire a distinct Enterprise price:
  [process.env.NEXT_PUBLIC_STRIPE_PRICE_ENTERPRISE, "ENTERPRISE"],
];

for (const [priceId, plan] of pricePlanPairs) {
  if (priceId) {
    PRICE_TO_PLAN[priceId] = plan;
  }
}

function mapPriceToPlan(priceId?: string | null): DbPlan | undefined {
  if (!priceId) return undefined;
  return PRICE_TO_PLAN[priceId];
}

// Type guard: true when it's a live (non-deleted) Customer
function isLiveCustomer(
  c: Stripe.Customer | Stripe.DeletedCustomer
): c is Stripe.Customer {
  // DeletedCustomer has { deleted: true }; Customer has no 'deleted' key
  return !("deleted" in (c as any) && (c as any).deleted === true);
}

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

  // 1) Try by customerId
  const byCustomer = await prisma.user.findFirst({
    where: { stripeCustomerId: customerId },
    select: { id: true },
  });
  if (byCustomer) {
    return prisma.user.update({ where: { id: byCustomer.id }, data: fields });
  }

  // 2) Fallback: fetch customer and try by email
  const retrieved = await stripe.customers.retrieve(customerId);
  const cust = retrieved as Stripe.Customer | Stripe.DeletedCustomer;

  if (isLiveCustomer(cust) && cust.email) {
    const byEmail = await prisma.user.findUnique({
      where: { email: cust.email },
      select: { id: true },
    });
    if (byEmail) {
      return prisma.user.update({
        where: { id: byEmail.id },
        data: { stripeCustomerId: customerId, ...fields },
      });
    }
  }

  return null;
}

export async function POST(req: Request) {
  let event: Stripe.Event;

  // Verify signature
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

  try {
    switch (event.type) {
      /**
       * Fired when Checkout completes successfully.
       * We link the user ↔ customer ↔ subscription, and ALSO
       * try to set the plan using metadata.plan_price_id.
       */
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = session.customer as string | undefined;
        const subscriptionId = session.subscription as string | undefined;

        let mappedPlan: DbPlan | undefined;

        // We stored the priceId in Checkout metadata from the /checkout route.
        const metaPriceId =
          typeof session.metadata?.plan_price_id === "string"
            ? session.metadata.plan_price_id.trim()
            : undefined;

        if (metaPriceId) {
          mappedPlan = mapPriceToPlan(metaPriceId);
        }

        // Only set plan if we can map cleanly; otherwise just link subscription.
        await upsertUserFromCustomerId(customerId ?? "", {
          stripeSubscriptionId: subscriptionId ?? undefined,
          plan: mappedPlan, // may be undefined; in that case we leave existing plan alone
          // status here is always "complete"/"paid" from Checkout POV;
          // subscription events below will refine planStatus & period end.
          planStatus: mappedPlan ? "active" : undefined,
          currentPeriodEnd: undefined,
        });

        break;
      }

      /**
       * Main driver for plan + status.
       * Handles new subscriptions and changes (upgrades/downgrades, renewals, etc.)
       */
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;

        let priceId: string | undefined;
        if (sub.items?.data?.length) {
          priceId = sub.items.data[0].price?.id ?? undefined;
        }

        const mappedPlan = mapPriceToPlan(priceId);

        const activeStatuses = ["trialing", "active", "past_due"] as const;
        const isActive = activeStatuses.includes(sub.status as any);

        // If we know the plan AND it's in an active-ish status, use it.
        // Otherwise fall back to LITE (baseline plan).
        const plan: DbPlan = mappedPlan && isActive ? mappedPlan : "LITE";

        // ✅ SAFELY derive currentPeriodEnd (may be missing on some events)
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

      /**
       * Safety net: whenever an invoice is paid, make sure subscription + plan
       * are set correctly (especially first invoice from Checkout).
       */
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string | null;
        if (!customerId) break;

        let priceId: string | undefined;
        const firstLine = invoice.lines?.data?.[0];
        if (firstLine) {
          priceId = firstLine.price?.id ?? undefined;
        }

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
          // Only set if we can map cleanly; otherwise leave existing plan alone.
          plan: mappedPlan ?? undefined,
          planStatus: "active",
          currentPeriodEnd,
        });

        break;
      }

      /**
       * Fired when a subscription is canceled or ends.
       * We downgrade to LITE and clear subscription linkage.
       */
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await upsertUserFromCustomerId(sub.customer as string, {
          stripeSubscriptionId: null,
          plan: "LITE",
          planStatus: "canceled",
          currentPeriodEnd: null,
        });
        break;
      }

      default:
        // ignore other events
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error("❌ Webhook handler error:", err);
    return new NextResponse("Webhook handler error", { status: 500 });
  }
}
