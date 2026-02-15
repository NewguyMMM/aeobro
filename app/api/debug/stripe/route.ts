// app/api/debug/stripe/route.ts
import Stripe from "stripe";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

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

export async function GET() {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const mode = keyMode(stripeSecretKey);

  const lite = process.env.STRIPE_PRICE_LITE;
  const plus = process.env.STRIPE_PRICE_PLUS;

  const base: any = {
    ok: true,
    vercelEnv: process.env.VERCEL_ENV || "unknown",
    stripeSecretKeyPresent: Boolean(stripeSecretKey),
    stripeSecretKeyMode: mode,
    stripeSecretKeyRedacted: redactKey(stripeSecretKey),
    stripePriceLitePresent: Boolean(lite),
    stripePricePlusPresent: Boolean(plus),
    stripePriceLite: lite || null,
    stripePricePlus: plus || null,
  };

  if (!stripeSecretKey) {
    return NextResponse.json(
      {
        ...base,
        ok: false,
        error: "STRIPE_SECRET_KEY missing",
      },
      { status: 500 }
    );
  }

  const stripe = new Stripe(stripeSecretKey, { apiVersion: "2024-06-20" });

  // Retrieve account to prove which Stripe account you're hitting
  let account: any = null;
  try {
    account = await stripe.accounts.retrieve();
  } catch (e: any) {
    base.ok = false;
    base.accountRetrieveError = e?.message || String(e);
  }

  // Retrieve prices to prove price IDs exist for this key/account/mode
  async function safeRetrievePrice(priceId: string | undefined) {
    if (!priceId) return { ok: false, error: "missing_price_id" };
    try {
      const p = await stripe.prices.retrieve(priceId);
      return {
        ok: true,
        id: p.id,
        livemode: p.livemode,
        currency: p.currency,
        unit_amount: p.unit_amount,
        recurring: p.recurring || null,
        product: p.product,
        active: p.active,
        nickname: p.nickname || null,
      };
    } catch (e: any) {
      return {
        ok: false,
        id: priceId,
        error: e?.message || String(e),
      };
    }
  }

  const liteRes = await safeRetrievePrice(lite);
  const plusRes = await safeRetrievePrice(plus);

  const resp = {
    ...base,
    account: account
      ? {
          id: account.id,
          country: account.country,
          email: account.email || null,
          charges_enabled: account.charges_enabled,
          payouts_enabled: account.payouts_enabled,
          details_submitted: account.details_submitted,
        }
      : null,
    prices: {
      lite: liteRes,
      plus: plusRes,
    },
  };

  const status =
    resp.ok && liteRes.ok && plusRes.ok && mode !== "missing" ? 200 : 500;

  return NextResponse.json(resp, { status });
}
