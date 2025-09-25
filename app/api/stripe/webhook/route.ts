import { NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET!;

// Map Stripe Price IDs → your Prisma Plan enum
const PRICE_TO_PLAN: Record<string, "LITE" | "PRO" | "BUSINESS"> = {
  [process.env.NEXT_PUBLIC_STRIPE_PRICE_LITE ?? ""]: "LITE",
  [process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO ?? ""]: "PRO",
  [process.env.NEXT_PUBLIC_STRIPE_PRICE_BUSINESS ?? ""]: "BUSINESS",
};

// Narrow a retrieved customer to a non-deleted Customer
function isLiveCustomer(
  c: unknown
): c is Stripe.Customer {
  return (
    typeof c === "object" &&
    c !== null &&
    // @ts-expect-error: runtime guard for union
    (c as any).deleted !== true
  );
}

async function upsertUserFromCustomerId(
  customerId: string,
  fields: {
    stripeSubscriptionId?: string | null;
    plan?: "FREE" | "LITE" | "PRO" | "BUSINESS";
    planStatus?: string;
    currentPeriodEnd?: Date | null;
  },
) {
  // 1) Try by customerId
  const byCustomer = await prisma.user.findFirst({
    where: { stripeCustomerId: customerId },
    select: { id: true },
  });
  if (byCustomer) {
    return prisma.user.update({ where: { id: byCustomer.id }, data: fields });
  }

  // 2) Fallback: get email from Stripe customer (if not deleted), then match by email
  const retrieved =
    (await stripe.customers.retrieve(customerId)) as unknown as
      | Stripe.Customer
      | Stripe.DeletedCustomer;

  if (isLiveCustomer(retrieved) && retrieved.email) {
    const byEmail = await prisma.user.findUnique({
      where: { email: retrieved.email },
      select: { id: true },
    });
    if (byEmail) {
      return prisma.user.update({
        where: { id: byEmail.id },
        data: { stripeCustomerId: customerId, ...fields },
      });
    }
  }

  // No matching user; nothing to do
  return null;
}

export async function POST(req: Request) {
  let event: Stripe.Event;

  // Verify signature
  try {
    const signature = req.headers.get("stripe-signature")!;
    const raw = await req.text();
    event = stripe.webhooks.constructEvent(raw, signature, WEBHOOK_SECRET);
  } catch (err: any) {
    console.error("❌ Invalid Stripe signature:", err?.message);
    return new NextResponse("Invalid signature", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = session.customer as string | undefined;
        const subscriptionId = session.subscription as string | undefined;

        if (customerId && subscriptionId) {
          await upsertUserFromCustomerId(customerId, {
            stripeSubscriptionId: subscriptionId,
          });
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;

        const priceId = sub.items?.data?.[0]?.price?.id || "";
        const mappedPlan = PRICE_TO_PLAN[priceId];
        const plan =
          mappedPlan && ["trialing", "active", "past_due"].includes(sub.status)
            ? mappedPlan
            : ("FREE" as const);

        await upsertUserFromCustomerId(sub.customer as string, {
          stripeSubscriptionId: sub.id,
          plan,
          planStatus: sub.status,
          currentPeriodEnd: new Date(sub.current_period_end * 1000),
        });
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await upsertUserFromCustomerId(sub.customer as string, {
          stripeSubscriptionId: null,
          plan: "FREE",
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
