// app/api/stripe/checkout/route.ts
import Stripe from 'stripe';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs'; // use Node (Stripe SDK needs it)

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

export async function POST(req: Request) {
  try {
    const { priceId } = await req.json();

    if (!priceId) {
      return NextResponse.json({ error: 'Missing priceId' }, { status: 400 });
    }

    const siteUrl = process.env.SITE_URL ?? 'http://localhost:3000';

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: `${siteUrl}/dashboard?checkout=success`,
      cancel_url: `${siteUrl}/pricing?checkout=cancelled`,
      billing_address_collection: 'auto',
      automatic_tax: { enabled: true },
    });

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (err: any) {
    console.error('Stripe checkout error:', err);
    return NextResponse.json({ error: err.message ?? 'Checkout error' }, { status: 500 });
  }
}
