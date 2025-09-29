// app/checkout/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Stripe from "stripe";
import { getRuntimeBaseUrl } from "@/lib/getBaseUrl";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const priceId = url.searchParams.get("priceId") || "";
  const plan = url.searchParams.get("plan") || "Lite";

  if (!priceId) {
    return NextResponse.redirect(new URL("/pricing", url));
  }

  // If not signed in, send to NextAuth email screen and bounce back here
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    const signin = new URL("/api/auth/signin/email", url);
    signin.searchParams.set(
      "callbackUrl",
      `/checkout?plan=${encodeURIComponent(plan)}&priceId=${encodeURIComponent(priceId)}`
    );
    return NextResponse.redirect(signin);
  }

  const base = getRuntimeBaseUrl(); // e.g. https://aeobro.com
  const success_url = `${base}/welcome?plan=${encodeURIComponent(plan)}`;
  const cancel_url = `${base}/pricing`;

  // If you store Stripe customer IDs, pass { customer } instead of customer_email
  const checkout = await stripe.checkout.sessions.create({
    mode: "subscription",
    success_url,
    cancel_url,
    line_items: [{ price: priceId, quantity: 1 }],
    customer_email: session.user.email,
    client_reference_id: (session.user as any).id ?? undefined,
    metadata: { plan },
    allow_promotion_codes: true,
  });

  return NextResponse.redirect(checkout.url!);
}
