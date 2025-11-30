// app/api/stripe/create-portal-session/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2024-06-20" as any,
});

function jsonError(status: number, message: string, extra?: any) {
  return NextResponse.json({ ok: false, message, ...extra }, { status });
}

export async function POST() {
  // 🔒 1) Require a logged-in user
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return jsonError(401, "Unauthorized");
  }

  const email = session.user.email;

  // 🔎 2) Look up user and existing Stripe customer id in Prisma
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, stripeCustomerId: true },
  });

  if (!user) {
    return jsonError(404, "User not found");
  }

  let stripeCustomerId = user.stripeCustomerId || undefined;

  // 🆕 3) If no Stripe customer yet, create one and persist it
  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email,
      metadata: { aeobroUserId: user.id },
    });

    stripeCustomerId = customer.id;

    await prisma.user.update({
      where: { id: user.id },
      data: { stripeCustomerId },
    });
  }

  // 🌐 4) Build base URL for return_url
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.SITE_URL ??
    "http://localhost:3000";

  // 5) Create Stripe Billing Portal session
  const portalSession = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: `${baseUrl}/billing`,
  });

  return NextResponse.json({ ok: true, url: portalSession.url });
}
