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

// Allow only the prices you’ve exposed via env
const ALLOWED_PRICE_IDS = [
  process.env.NEXT_PUBLIC_STRIPE_PRICE_LITE,
  process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO,
  process.env.NEXT_PUBLIC_STRIPE_PRICE_BUSINESS,
  process.env.NEXT_PUBLIC_STRIPE_PRICE_ENTERPRISE,
].filter(Boolean) as string[];

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
      return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
    }

    const { priceId } = await req.json();
    if (!priceId) {
      return NextResponse.json({ ok: false, message: "Missing priceId" }, { status: 400 });
    }
    if (!ALLOWED_PRICE_IDS.includes(priceId)) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Invalid priceId (not in allowlist). Check NEXT_PUBLIC_STRIPE_PRICE_* in your env.",
        },
        { status: 400 }
      );
    }

    // --- HOTFIX: don't rely on stripeCustomerId column yet ---
    // Ensure we have a User row; if missing (e.g., after DB reset), create it.
    let user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, email: true },
    });
    if (!user) {
      user = await prisma.user.create({
        data: { email: session.user.email, name: session.user.name ?? null },
        select: { id: true, email: true },
      });
    }

    // Reuse an existing Stripe customer for this email if possible, else create one
    const existing = await stripe.customers.list({ email: user.email, limit: 1 });
    const customerId =
      existing.data[0]?.id || (await stripe.customers.create({ email: user.email })).id;

    const base = appBaseUrl();

    const checkout = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId, // ✅ keep ONLY customer; DO NOT include customer_email simultaneously
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      automatic_tax: { enabled: false },

      success_url: `${base}/dashboard?checkout=success`,
      cancel_url: `${base}/pricing?checkout=cancel`,

      // Note: Do NOT set `customer_email` when `customer` is provided
      metadata: { plan_price_id: priceId, user_email: user.email },
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
