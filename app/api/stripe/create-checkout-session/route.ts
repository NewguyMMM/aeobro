// app/api/stripe/create-checkout-session/route.ts
import Stripe from "stripe";
import { NextResponse } from "next/server";

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
  // Server-authoritative mapping ONLY.
  // Set these in Vercel env. Do NOT use NEXT_PUBLIC vars for pricing correctness.
  const LITE = process.env.STRIPE_PRICE_LITE;
  const PLUS = process.env.STRIPE_PRICE_PLUS;

  if (!LITE || !PLUS) {
    throw new Error(
      "Missing STRIPE_PRICE_LITE and/or STRIPE_PRICE_PLUS environment variables."
    );
  }

  if (plan === "lite") return LITE;
  return PLUS;
}

export async function POST(req: Request) {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const mode = keyMode(stripeSecretKey);

  // Tight request parsing
  let body: any = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }

  const origin = req.headers.get("origin") || process.env.APP_URL || "http://localhost:3000";

  // Debug logging (temporary; keep until stable)
  console.log("[stripe][create-checkout-session] incoming payload:", body);
  console.log("[stripe][create-checkout-session] origin:", origin);
  console.log("[stripe][create-checkout-session] STRIPE_SECRET_KEY mode:", mode, "key:", redactKey(stripeSecretKey));

  if (!stripeSecretKey) {
    console.error("[stripe][create-checkout-session] STRIPE_SECRET_KEY is missing");
    return NextResponse.json({ error: "Server misconfigured: STRIPE_SECRET_KEY missing" }, { status: 500 });
  }

  const planRaw = body?.plan;
  if (!isPlan(planRaw)) {
    console.warn("[stripe][create-checkout-session] invalid plan:", planRaw);
    return NextResponse.json({ error: "Invalid plan. Must be 'lite' or 'plus'." }, { status: 400 });
  }

  // IMPORTANT: ignore any client-provided priceId completely
  const resolvedPlan: Plan = planRaw;
  let priceId: string;
  try {
    priceId = getAuthoritativePriceId(resolvedPlan);
  } catch (e: any) {
    console.error("[stripe][create-checkout-session] price mapping error:", e?.message || e);
    return NextResponse.json({ error: e?.message || "Server misconfigured: price mapping missing" }, { status: 500 });
  }

  console.log("[stripe][create-checkout-session] resolved plan:", resolvedPlan);
  console.log("[stripe][create-checkout-session] using priceId:", priceId);

  const stripe = new Stripe(stripeSecretKey, {
    apiVersion: "2024-06-20",
  });

  // Optional: fail-fast if Stripe cannot retrieve the price with this key
  // This directly catches "No such price" due to key/account mismatch.
  try {
    const p = await stripe.prices.retrieve(priceId);
    console.log("[stripe][create-checkout-session] price retrieve OK:", {
      id: p.id,
      currency: p.currency,
      unit_amount: p.unit_amount,
      product: p.product,
      livemode: p.livemode,
    });
  } catch (err: any) {
    console.error("[stripe][create-checkout-session] price retrieve FAILED:", err?.message || err);
    return NextResponse.json(
      {
        error:
          "Stripe price lookup failed. This usually means your STRIPE_SECRET_KEY does not match the account/mode that owns this price ID.",
        details: err?.message || String(err),
        resolvedPlan,
        priceId,
        secretKeyMode: mode,
      },
      { status: 500 }
    );
  }

  const successUrl = `${origin}/billing/success?plan=${encodeURIComponent(resolvedPlan)}`;
  const cancelUrl = `${origin}/pricing?canceled=1`;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      // You can wire auth later; for now keep it simple.
      metadata: {
        plan: resolvedPlan,
        price_id: priceId,
        env: process.env.VERCEL_ENV || "unknown",
        key_mode: mode,
      },
      // Optional but useful:
      // allow_promotion_codes: true,
    });

    console.log("[stripe][create-checkout-session] created session:", {
      id: session.id,
      url: session.url,
      mode: session.mode,
    });

    return NextResponse.json({ url: session.url, plan: resolvedPlan, priceId }, { status: 200 });
  } catch (err: any) {
    console.error("[stripe][create-checkout-session] session create FAILED:", err?.message || err);
    return NextResponse.json(
      { error: "Failed to create Stripe Checkout session", details: err?.message || String(err) },
      { status: 500 }
    );
  }
}
