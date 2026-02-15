// app/api/stripe/create-portal-session/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getServerSession } from "next-auth/next"; // ✅ App Router correct import
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(status: number, message: string, extra?: Record<string, any>) {
  return NextResponse.json({ ok: false, message, ...(extra ?? {}) }, { status });
}

function isStripeMissingResource(err: any) {
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

    // 🔎 2) Load user billing identifiers (customer + subscription)
    const user = await prisma.user.findUnique({
      where: { email },
      // IMPORTANT: make sure your Prisma User model has stripeSubscriptionId
      select: { id: true, stripeCustomerId: true, stripeSubscriptionId: true },
    });

    if (!user) {
      return jsonError(404, "User not found");
    }

    // ✅ Stripe secret key
    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) {
      return jsonError(500, "Stripe secret key missing");
    }

    console.log("[portal] key_mode", { looksLive: secret.startsWith("sk_live_") });

    const stripe = new Stripe(secret, {
      apiVersion: "2024-06-20" as any,
    });

    // 🌐 3) Return origin derived from request (no env guessing)
    const origin = new URL(request.url).origin;
    const returnUrl = `${origin}/billing`;

    if (!origin.startsWith("https://")) {
      console.warn("[portal] Non-https origin detected:", origin);
    }

    let stripeCustomerId = user.stripeCustomerId || undefined;

    /**
     * ✅ 4) Never-drift logic:
     * If we have a subscription id, Stripe is the source of truth for customer.
     * This guarantees the billing portal always opens for the customer that owns the active subscription.
     */
    if (user.stripeSubscriptionId) {
      try {
        const sub = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);

        // sub.customer can be string or object depending on expand; normalize to string
        const subCustomerId =
          typeof sub.customer === "string" ? sub.customer : sub.customer?.id;

        if (subCustomerId && subCustomerId !== stripeCustomerId) {
          console.log("[portal] syncing customer from subscription", {
            userId: user.id,
            hadCustomerId: !!stripeCustomerId,
            changed: true,
          });

          stripeCustomerId = subCustomerId;

          await prisma.user.update({
            where: { id: user.id },
            data: { stripeCustomerId },
          });
        }
      } catch (err: any) {
        // If subscription is missing/wrong-mode, don't explode silently; surface it.
        if (isStripeMissingResource(err)) {
          return jsonError(409, "Stored subscription id is invalid in current Stripe mode", {
            stripeMessage: err?.message,
            stripeCode: err?.code,
            stripeType: err?.type,
            hint:
              "Your DB may contain a TEST subscription id. Update stripeSubscriptionId to the LIVE sub_... or clear it and re-checkout in LIVE.",
          });
        }
        throw err;
      }
    }

    // 🧪 5) If we still don't have a customer id, ensure one exists in this mode
    if (stripeCustomerId) {
      try {
        await stripe.customers.retrieve(stripeCustomerId);
      } catch (err: any) {
        if (isStripeMissingResource(err)) {
          console.warn("[portal] stored_customer_missing_recreating", { userId: user.id });
          stripeCustomerId = undefined;
        } else {
          throw err;
        }
      }
    }

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
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: returnUrl,
    });

    return NextResponse.json({ ok: true, url: portalSession.url });
  } catch (err: any) {
    console.error("[portal] create session failed", {
      message: err?.message,
      type: err?.type,
      code: err?.code,
      statusCode: err?.statusCode,
    });

    return jsonError(500, "Unable to create billing portal session", {
      stripeMessage: err?.message,
      stripeCode: err?.code,
      stripeType: err?.type,
    });
  }
}
