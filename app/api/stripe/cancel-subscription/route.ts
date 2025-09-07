// app/api/stripe/cancel-subscription/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { stripe } from "@/lib/stripe";

/**
 * POST /api/stripe/cancel-subscription
 * Cancels the user's active subscription at period end (no immediate cancel, no auto-refund).
 */
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1) Find Stripe customer(s) for this email
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

    // 2) Find an active-ish subscription for any of those customers
    const candidateStatuses = new Set(["active", "trialing", "past_due", "unpaid"] as const);

    let foundSub: any = null;
    for (const c of customers.data) {
      const subs = await stripe.subscriptions.list({
        customer: c.id,
        status: "all",
        limit: 10,
      });
      const activeLike = subs.data.find((s) => candidateStatuses.has(s.status as any));
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

    // 3) Standard SaaS behavior: cancel at period end
    const updated = await stripe.subscriptions.update(foundSub.id, {
      cancel_at_period_end: true,
    });

    return NextResponse.json({
      ok: true,
      subscriptionId: updated.id,
      status: updated.status,
      cancel_at_period_end: updated.cancel_at_period_end,
      current_period_end: updated.current_period_end, // Unix timestamp (seconds)
    });
  } catch (err: any) {
    console.error("Cancel subscription error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Internal Server Error" },
      { status: 500 }
    );
  }
}
