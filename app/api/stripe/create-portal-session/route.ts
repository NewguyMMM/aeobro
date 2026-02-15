// app/api/stripe/create-portal-session/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getServerSession } from "next-auth/next"; // ✅ IMPORTANT for App Router route handlers
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Standard JSON error helper.
 * Keeps responses consistent for the client and makes debugging easier.
 */
function jsonError(status: number, message: string, extra?: Record<string, any>) {
  return NextResponse.json({ ok: false, message, ...(extra ?? {}) }, { status });
}

function isStripeMissingResource(err: any) {
  // Covers "No such customer" / resource_missing cases
  return (
    err?.type === "StripeInvalidRequestError" &&
    (err?.code === "resource_missing" ||
      (typeof err?.message === "string" && err.message.toLowerCase().includes("no such")))
  );
}

export async function POST(request: Request) {
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

    // Helpful, non-sensitive logging: confirms which key-mode this route is using
    console.log("[portal] key_mode", { looksLive: secret.startsWith("sk_live_") });

    // ✅ Create Stripe client from the same secret used in production
    const stripe = new Stripe(secret, {
      apiVersion: "2024-06-20" as any,
    });

    // 🌐 3) Determine a safe return URL origin (always correct for the request)
    // This avoids env drift and avoids relying on Origin header presence.
    const requestOrigin = new URL(request.url).origin;

    // If you want to force a canonical return origin, set NEXT_PUBLIC_APP_URL and use it here:
    // const origin = process.env.NEXT_PUBLIC_APP_URL || requestOrigin;
    const origin = requestOrigin;

    if (!origin.startsWith("https://")) {
      console.warn("[portal] Non-https origin detected:", origin);
    }

    // 4) Ensure we have a Stripe customer ID in the CURRENT mode.
    // If the stored ID is from TEST (or deleted), Stripe LIVE will throw "No such customer".
    let stripeCustomerId = user.stripeCustomerId || undefined;

    if (stripeCustomerId) {
      try {
        await stripe.customers.retrieve(stripeCustomerId);
      } catch (err: any) {
        if (isStripeMissingResource(err)) {
          console.warn("[portal] stored_customer_missing_recreating", {
            userId: user.id,
          });
          stripeCustomerId = undefined;
        } else {
          throw err;
        }
      }
    }

    // 🆕 5) If no Stripe customer yet, create one and persist it
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

    // 6) Create Stripe Billing Portal session
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
