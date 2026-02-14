// app/api/stripe/create-checkout-session/route.ts
// ✅ Updated: 2026-02-14
// - Server-authoritative plan -> price mapping (prevents wrong $4.99 price)
// - Still supports legacy { priceId } but blocks unknown/old priceIds
// - Accepts { plan } or { plan, priceId } from client
// - Keeps webhook metadata.plan_price_id
// - Reuses & stores stripeCustomerId on the User

import Stripe from "stripe";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY as string;
if (!STRIPE_SECRET_KEY) {
  throw new Error("Missing STRIPE_SECRET_KEY in environment");
}

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

/**
 * Stripe TEST price IDs you gave me.
 * These are NOT secrets (Price IDs are public identifiers).
 * We use them only as fallbacks if env vars are missing.
 */
const FALLBACK_TEST_PRICES = {
  LITE: "price_1T0l7WBWc0vqeQejEjQ4t8ts",
  PLUS: "price_1T0l7qBWc0vqeQejYB3IThkA",
} as const;

type PlanKey = "LITE" | "PLUS" | "PRO" | "BUSINESS" | "ENTERPRISE";

const PRICE_BY_PLAN: Record<PlanKey, string> = {
  LITE: (process.env.NEXT_PUBLIC_STRIPE_PRICE_LITE || FALLBACK_TEST_PRICES.LITE).trim(),
  PLUS: (process.env.NEXT_PUBLIC_STRIPE_PRICE_PLUS || FALLBACK_TEST_PRICES.PLUS).trim(),
  PRO: (process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO || "").trim(),
  BUSINESS: (process.env.NEXT_PUBLIC_STRIPE_PRICE_BUSINESS || "").trim(),
  ENTERPRISE: (process.env.NEXT_PUBLIC_STRIPE_PRICE_ENTERPRISE || "").trim(),
};

// Hard allow-list (ONLY these price IDs are allowed)
const ALLOWED_PRICE_IDS = Array.from(
  new Set(Object.values(PRICE_BY_PLAN).filter(Boolean).map((v) => v.trim()))
);

function appBaseUrl() {
  const u =
    process.env.NEXTAUTH_URL ||
    process.env.VERCEL_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.SITE_URL ||
    "http://localhost:3000";

  return u.startsWith("http") ? u : `https://${u}`;
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { ok: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as {
      priceId?: string;
      plan?: string;
    };

    const planRaw = (body.plan ?? "").toString().trim().toUpperCase();
    const plan = (["LITE", "PLUS", "PRO", "BUSINESS", "ENTERPRISE"].includes(planRaw)
      ? (planRaw as PlanKey)
      : null);

    const requested = (body.priceId ?? "").toString().trim();

    /**
     * ✅ Server-authoritative selection:
     * If plan is provided, we ignore any wrong/old client priceId.
     */
    let normalizedPriceId = "";
    if (plan) {
      normalizedPriceId = PRICE_BY_PLAN[plan];
    } else {
      // Legacy mode: client sends priceId
      normalizedPriceId = requested;
    }

    if (!normalizedPriceId) {
      return NextResponse.json(
        {
          ok: false,
          message: plan
            ? `Missing configured Price ID for plan ${plan}. Set NEXT_PUBLIC_STRIPE_PRICE_${plan} in Vercel Project env.`
            : "Missing priceId",
        },
        { status: 400 }
      );
    }

    // ✅ HARD BLOCK: prevents charging stale/unknown $4.99 prices
    if (!ALLOWED_PRICE_IDS.includes(normalizedPriceId)) {
      console.warn("[checkout] BLOCKED priceId (not allowed)", {
        plan,
        received: requested,
        resolved: normalizedPriceId,
        allowed: ALLOWED_PRICE_IDS,
      });

      return NextResponse.json(
        {
          ok: false,
          message:
            "Invalid priceId. Your deployment is likely using stale pricing configuration. Redeploy after updating Vercel Project env vars.",
        },
        { status: 400 }
      );
    }

    // Ensure a User row exists
    let user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        email: true,
        name: true,
        stripeCustomerId: true,
      },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: session.user.email,
          name: session.user.name ?? null,
        },
        select: {
          id: true,
          email: true,
          name: true,
          stripeCustomerId: true,
        },
      });
    }

    const email: string = user.email ?? session.user.email;
    let stripeCustomerId = user.stripeCustomerId ?? undefined;

    if (!stripeCustomerId) {
      if (email) {
        const existing = await stripe.customers.list({ email, limit: 1 });
        if (existing.data[0]?.id) stripeCustomerId = existing.data[0].id;
      }

      if (!stripeCustomerId) {
        const customer = await stripe.customers.create({
          email,
          name: user.name ?? undefined,
        });
        stripeCustomerId = customer.id;
      }

      await prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId },
      });
    }

    const base = appBaseUrl();

    // Helpful server log (you can remove later)
    console.log("[checkout] create session", {
      plan,
      priceId: normalizedPriceId,
      base,
      email,
      userId: user.id,
    });

    const checkout = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: stripeCustomerId,
      line_items: [{ price: normalizedPriceId, quantity: 1 }],
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      automatic_tax: { enabled: false },
      success_url: `${base}/dashboard?checkout=success`,
      cancel_url: `${base}/pricing?checkout=cancel`,
      client_reference_id: user.id,
      metadata: {
        plan_price_id: normalizedPriceId,
        user_email: email,
        user_id: user.id,
      },
      subscription_data: {
        metadata: {
          plan_price_id: normalizedPriceId,
          user_email: email,
          user_id: user.id,
        },
      },
    });

    if (!checkout.url) {
      return NextResponse.json(
        { ok: false, message: "Stripe did not return a Checkout URL" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, url: checkout.url });
  } catch (err: any) {
    console.error("checkout error:", err);
    return NextResponse.json(
      { ok: false, message: err?.message || "Checkout error" },
      { status: 500 }
    );
  }
}
