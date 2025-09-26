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

const ALLOWED_PRICE_IDS = [
  process.env.NEXT_PUBLIC_STRIPE_PRICE_LITE!,
  process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO!,
  process.env.NEXT_PUBLIC_STRIPE_PRICE_BUSINESS!,
  process.env.NEXT_PUBLIC_STRIPE_PRICE_ENTERPRISE!,
].filter(Boolean);

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
      return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
    }

    const { priceId } = await req.json();
    if (!priceId) {
      return NextResponse.json({ ok: false, message: "Missing priceId" }, { status: 400 });
    }
    if (!ALLOWED_PRICE_IDS.includes(priceId)) {
      return NextResponse.json(
        { ok: false, message: "Invalid priceId (not in allowlist). Check NEXT_PUBLIC_STRIPE_PRICE_*." },
        { status: 400 }
      );
    }

    // --- HOTFIX: do NOT read/write user.stripeCustomerId (column not available yet)
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, email: true },
    });
    if (!user?.email) {
      return NextResponse.json({ ok: false, message: "User not found" }, { status: 401 });
    }

    // Try to reuse an existing Stripe customer by email; else create one
    const existing = await stripe.customers.list({ email: user.email, limit: 1 });
    const customerId =
      existing.data[0]?.id || (await stripe.customers.create({ email: user.email })).id;

    const base = appBaseUrl();

    const checkout = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      automatic_tax: { enabled: false },
      success_url: `${base}/dashboard?checkout=success`,
      cancel_url: `${base}/pricing?checkout=cancel`,
      customer_email: user.email,
      metadata: { plan_price_id: priceId, user_email: user.email },
    });

    if (!checkout.url) {
      return NextResponse.json({ ok: false, message: "Stripe did not return a URL" }, { status: 500 });
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
