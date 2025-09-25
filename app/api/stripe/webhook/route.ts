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
  // Enterprise omitted on purpose; add if you want to handle it.
};

async function upsertUserFromCustomerId(
  customerId: string,
  fields: {
    stripeSubscriptionId?: string | null;
    plan?: "FREE" | "LITE" | "PRO" | "BUSINESS";
    planStatus?: string;
    currentPeriodEnd?: Date | null;
  },
) {
  // First try to update by customerId
  const userByCustomer = await prisma.user.findFirst({
    where: { stripeCustomerId: customerId },
    select: { id: true },
  });

  if (userByCustomer) {
    return prisma.user.update({
      where: { id: userByCustomer.id },
      data: fields,
    });
  }

  // Fallback: fetch customer email, try update by email
  const customer = await stripe.customers.retrieve(customerId);
  if (customer && typeof customer !== "string" && customer.email) {
    const userByEmail = await prisma.user.findUnique({
      where: { email: customer.email },
      select: { id: true },
    });
    if (userByEmail) {
      return prisma.user.update({
        where: { id: userByEmail.id },
        data: { stripeCustomerId: customerId, ...fields },
      });
    }
  }

  // No matching user; nothing to do
  return null;
}

export async function POST(req: Request) {
  let event: Stripe.Event;

  try {
    const signature = req.headers.get("stripe-signature")!;
    const rawBody = await req.text();
    event = stripe.webhooks.constructEvent(rawBody, signature, WEBHOOK_SECRET);
  } catch (err: any) {
    console.error("❌ Webhook signature verification failed:", err?.message);
    return new NextResponse("Invalid signature", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        // Optionally grab subscription id and attach to user early
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = session.customer as string | undefined;
        const subscriptionId = session.subscription as string | undefined;

        if (customerId && subscriptionId) {
          await upsertUserFromCustomerId(customerId, {
            stripeSubscriptionId: subscriptionId,
            // plan gets set on subscription.* below (more reliable)
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
            : ("FREE" as const); // fallback if price not recognized

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
        // Ignore other events (you can add more if needed)
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error("❌ Webhook handler error:", err);
    return new NextResponse("Webhook handler error", { status: 500 });
  }
}
