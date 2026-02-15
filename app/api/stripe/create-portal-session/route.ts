// app/api/stripe/create-portal-session/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Standard JSON error helper.
 * Keeps responses consistent for the client and makes debugging easier.
 */
function jsonError(status: number, message: string, extra?: Record<string, any>) {
  return NextResponse.json({ ok: false, message, ...(extra ?? {}) }, { status });
}

export async function POST() {
  try {
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

    // ✅ Ensure Stripe secret key exists
    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) {
      return jsonError(500, "Stripe secret key missing");
    }

    // ✅ Create Stripe client from the same secret used in production
    const stripe = new Stripe(secret, {
      apiVersion: "2024-06-20" as any,
    });

    // 🌐 3) Determine a safe return URL origin
    // Prefer request origin in production; fall back to envs; never silently use localhost in prod.
    const h = headers();
    const origin =
      h.get("origin") ||
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.SITE_URL ||
      "";

    if (!origin) {
      return jsonError(500, "Missing origin/base URL for billing portal return_url", {
        hint: "Set NEXT_PUBLIC_APP_URL (recommended) or SITE_URL in production env.",
      });
    }

    if (!origin.startsWith("https://")) {
      // Not fatal in all cases, but Stripe LIVE commonly expects https.
      console.warn("[portal] Non-https origin detected:", origin);
    }

    let stripeCustomerId = user.stripeCustomerId || undefined;

    // 🆕 4) If no Stripe customer yet, create one and persist it
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

    // 5) Create Stripe Billing Portal session
    const returnUrl = `${origin}/billing`;

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: returnUrl,
    });

    return NextResponse.json({ ok: true, url: portalSession.url });
  } catch (err: any) {
    // 🔎 Production-safe logging (no secrets)
    console.error("[portal] create session failed", {
      message: err?.message,
      type: err?.type,
      code: err?.code,
      statusCode: err?.statusCode,
    });

    // Return structured info so the client console shows something actionable
    return jsonError(500, "Unable to create billing portal session", {
      stripeMessage: err?.message,
      stripeCode: err?.code,
      stripeType: err?.type,
    });
  }
}
