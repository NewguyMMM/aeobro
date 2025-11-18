// app/api/stripe/create-checkout-session/route.ts
import Stripe from "stripe";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

/**
 * Allow only the prices you’ve exposed via env.
 * We normalize & trim so stray spaces don’t break equality.
 */
const RAW_ALLOWED = [
  process.env.NEXT_PUBLIC_STRIPE_PRICE_LITE,
  process.env.NEXT_PUBLIC_STRIPE_PRICE_PLUS,       // Plus tier
  process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO,
  process.env.NEXT_PUBLIC_STRIPE_PRICE_BUSINESS,
  process.env.NEXT_PUBLIC_STRIPE_PRICE_ENTERPRISE,
];

const ALLOWED_PRICE_IDS: string[] = RAW_ALLOWED
  .filter((v): v is string => typeof v === "string")
  .map((v) => v.trim())
  .filter(Boolean);

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
    // Require auth so we can associate the purchase with a user
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { ok: false, message: "Unauthorized" },
        { status: 401 },
      );
    }

    const { priceId } = (await req.json()) as { priceId?: string };

    if (!priceId) {
      return NextResponse.json(
        { ok: false, message: "Missing priceId" },
        { status: 400 },
      );
    }

    const normalizedPriceId = priceId.trim();

    // 🔎 Soft allow-list: log if it doesn’t match, but don’t block.
    if (
      ALLOWED_PRICE_IDS.length > 0 &&
      !ALLOWED_PRICE_IDS.includes(normalizedPriceId)
    ) {
      console.warn(
        "[checkout] priceId not in ALLOWED_PRICE_IDS",
        {
          received: normalizedPriceId,
          allowed: ALLOWED_PRICE_IDS,
        },
      );
      // We still proceed and let Stripe validate the ID.
    }

    // Ensure a User row exists (covers DB resets)
    let user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, email: true, name: true },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: session.user.email,
          name: session.user.name ?? null,
        },
        select: { id: true, email: true, name: true },
      });
    }

    const email: string = user.email ?? session.user.email;

    // Reuse existing Stripe customer by email if present
    const existing = await stripe.customers.list({ email, limit: 1 });
    const customerId =
      existing.data[0]?.id || (await stripe.customers.create({ email })).id;

    const base = appBaseUrl();

    const checkout = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId, // don't include customer_email simultaneously
      line_items: [{ price: normalizedPriceId, quantity: 1 }],
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      automatic_tax: { enabled: false },
      success_url: `${base}/dashboard?checkout=success`,
      cancel_url: `${base}/pricing?checkout=cancel`,
      metadata: { plan_price_id: normalizedPriceId, user_email: email },
    });

    if (!checkout.url) {
      return NextResponse.json(
        { ok: false, message: "Stripe did not return a Checkout URL" },
        { status: 500 },
      );
    }

    // IMPORTANT: return JSON (client will navigate)
    return NextResponse.json({ ok: true, url: checkout.url });
  } catch (err: any) {
    console.error("checkout error:", err);
    return NextResponse.json(
      { ok: false, message: err?.message || "Checkout error" },
      { status: 500 },
    );
  }
}
