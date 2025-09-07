// app/api/stripe/cancel-subscription/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { stripe } from "@/lib/stripe";

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Find customer(s) by email
    const customers = await stripe.customers.list({
      email: session.user.email,
      limit: 10,
    });

    if (!customers.data.length) {
      return NextResponse.json(
        { error: "No Stripe customer found for this user." },
        { status: 404 }
      );
    }

    // Find an active-ish subscription
    const candidateStatuses: Stripe.Subscription.Status[] = [
      "active",
      "trialing",
      "past_due",
      "unpaid",
    ];

    let foundSub: Stripe.Subscription | null = null;
    for (const c of customers.data) {
      const subs = await stripe.subscriptions.list({
        customer: c.id,
        status: "all",
        limit: 10,
      });
      const activeLike = subs.data.find((s) =>
        candidateStatuses.includes(s.status)
      );
      if (activeLike) {
        foundSub = activeLike;
        break;
      }
    }

    if (!foundSub) {
      return NextResponse.json(
        { error: "No active subscription found for this user." },
        { status: 404 }
      );
    }

    // Standard SaaS behavior: cancel at period end
    const updated = await stripe.subscriptions.update(foundSub.id, {
      cancel_at_period_end: true,
    });

    return NextResponse.json({
      ok: true,
      subscriptionId: updated.id,
      status: updated.status,
      cancel_at_period_end: updated.cancel_at_period_end,
      current_period_end: updated.current_period_end, // Unix timestamp
    });
  } catch (err: any) {
    console.error("Cancel subscription error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Internal Server Error" },
      { status: 500 }
    );
  }
}
