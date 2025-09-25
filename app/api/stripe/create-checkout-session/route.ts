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

// Allow only prices you’ve exposed in env
const ALLOWED_PRICE_IDS = [
  process.env.NEXT_PUBLIC_STRIPE_PRICE_LITE!,
  process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO!,
  process.env.NEXT_PUBLIC_STRIPE_PRICE_BUSINESS!,
  process.env.NEXT_PUBLIC_STRIPE_PRICE_ENTERPRISE!,
].filter(Boolean);

export async function POST(req: Request) {
  try {
    // Require auth so we can attach the sub to this user
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const { priceId } = await req.json();
    if (!priceId || !ALLOWED_PRICE_IDS.includes(priceId)) {
      return NextResponse.json({ ok: false, error: "INVALID_PRICE" }, { status: 400 });
    }

    // Ensure Stripe Customer exists and is linked to the user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, email: true, stripeCustomerId: true },
    });
    if (!user?.email) {
      return NextResponse.json({ ok: false, error: "NO_USER" }, { status: 401 });
    }

    const customerId =
      user.stripeCustomerId ||
      (await stripe.customers.create({ email: user.email })).id;

    if (!user.stripeCustomerId) {
      await prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId: customerId },
      });
    }

    // Build return URLs
    const origin =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.SITE_URL ||
      "http://localhost:3000";

    const checkout = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      automatic_tax: { enabled: false },

      // If you don't create /billing/success and /billing/cancel,
      // change these two lines to your existing pages (see Option B below).
      success_url: `${origin}/billing/success`,
      cancel_url: `${origin}/billing/cancel`,
    });

    return NextResponse.json({ ok: true, url: checkout.url });
  } catch (err: any) {
    console.error("checkout error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Checkout error" },
      { status: 500 },
    );
  }
}
