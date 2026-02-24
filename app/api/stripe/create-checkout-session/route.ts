// app/api/stripe/create-checkout-session/route.ts

import Stripe from "stripe";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

type Plan = "lite" | "plus";

function isPlan(x: any): x is Plan {
  return x === "lite" || x === "plus";
}

function keyMode(secretKey: string | undefined) {
  if (!secretKey) return "missing";
  if (secretKey.startsWith("sk_test_")) return "test";
  if (secretKey.startsWith("sk_live_")) return "live";
  return "unknown";
}

function redactKey(secretKey: string | undefined) {
  if (!secretKey) return "missing";
  return `${secretKey.slice(0, 10)}…${secretKey.slice(-6)}`;
}

function getAuthoritativePriceId(plan: Plan): string {
  const LITE = process.env.STRIPE_PRICE_LITE;
  const PLUS = process.env.STRIPE_PRICE_PLUS;

  if (!LITE || !PLUS) {
    throw new Error(
      "Missing STRIPE_PRICE_LITE and/or STRIPE_PRICE_PLUS environment variables."
    );
  }

  return plan === "lite" ? LITE : PLUS;
}

export async function POST(req: Request) {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const mode = keyMode(stripeSecretKey);

  if (!stripeSecretKey) {
    return NextResponse.json(
      { error: "Server misconfigured: STRIPE_SECRET_KEY missing" },
      { status: 500 }
    );
  }

  const stripe = new Stripe(stripeSecretKey, {
    apiVersion: "2024-06-20",
  });

  // Parse request body
  let body: any = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }

  const origin =
    req.headers.get("origin") ||
    process.env.APP_URL ||
    "http://localhost:3000";

  console.log("[stripe] payload:", body);
  console.log("[stripe] key mode:", mode, redactKey(stripeSecretKey));

  const planRaw = body?.plan;
  if (!isPlan(planRaw)) {
    return NextResponse.json(
      { error: "Invalid plan. Must be 'lite' or 'plus'." },
      { status: 400 }
    );
  }

  const resolvedPlan: Plan = planRaw;

  let priceId: string;
  try {
    priceId = getAuthoritativePriceId(resolvedPlan);
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Price mapping error" },
      { status: 500 }
    );
  }

  // Verify price exists (catches test/live mismatches early)
  try {
    await stripe.prices.retrieve(priceId);
  } catch (err: any) {
    return NextResponse.json(
      {
        error:
          "Stripe price lookup failed. Check STRIPE_SECRET_KEY and price ID mode.",
        details: err?.message || String(err),
      },
      { status: 500 }
    );
  }

  // 🔒 Get authenticated user
  const sessionUser = await getServerSession(authOptions);

  if (!sessionUser?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: sessionUser.user.email },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  let customerId = user.stripeCustomerId;

  // 🔥 CREATE STRIPE CUSTOMER ONLY IF MISSING
  if (!customerId) {
    console.log("[stripe] creating new Stripe customer for user");

    const customer = await stripe.customers.create({
      email: user.email,
      metadata: {
        aeobroUserId: user.id,
      },
    });

    customerId = customer.id;

    await prisma.user.update({
      where: { id: user.id },
      data: { stripeCustomerId: customerId },
    });

    console.log("[stripe] stored new stripeCustomerId:", customerId);
  } else {
    console.log("[stripe] reusing existing stripeCustomerId:", customerId);
  }

  const successUrl = `${origin}/billing/success?plan=${resolvedPlan}`;
  const cancelUrl = `${origin}/pricing?canceled=1`;

  try {
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId, // 🔥 prevents duplicate Stripe customers
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        plan: resolvedPlan,
        price_id: priceId,
        aeobroUserId: user.id,
        key_mode: mode,
      },
    });

    console.log("[stripe] checkout session created:", checkoutSession.id);

    return NextResponse.json(
      { url: checkoutSession.url },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("[stripe] checkout creation failed:", err?.message || err);

    return NextResponse.json(
      {
        error: "Failed to create Stripe Checkout session",
        details: err?.message || String(err),
      },
      { status: 500 }
    );
  }
}
