// /app/api/stripe/checkout/route.ts
import Stripe from 'stripe';
import { NextResponse } from 'next/server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' });

const ALLOWED_PRICE_IDS = [
  process.env.NEXT_PUBLIC_STRIPE_PRICE_LITE!,
  process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO!,
  process.env.NEXT_PUBLIC_STRIPE_PRICE_BUSINESS!,
  process.env.NEXT_PUBLIC_STRIPE_PRICE_ENTERPRISE!,
].filter(Boolean);

// ...top of file unchanged...

export async function POST(req: Request) {
  try {
    const { priceId } = await req.json();

    if (!priceId || !ALLOWED_PRICE_IDS.includes(priceId)) {
      return NextResponse.json({ error: 'Invalid priceId' }, { status: 400 });
    }

    const origin = process.env.SITE_URL || 'http://localhost:3000';

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      // send the user to a friendly page after Stripe
      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/cancel`,
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      automatic_tax: { enabled: false },
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message || 'Checkout error' }, { status: 500 });
  }
}
