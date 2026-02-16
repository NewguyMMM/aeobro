// app/api/stripe/create-portal-session/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getServerSession } from "next-auth/next"; // ✅ App Router correct import
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type JsonExtra = Record<string, any>;

function jsonError(status: number, message: string, extra?: JsonExtra) {
  return NextResponse.json({ ok: false, message, ...(extra ?? {}) }, { status });
}

function isStripeMissingResource(err: any) {
  return (
    err?.type === "StripeInvalidRequestError" &&
    (err?.code === "resource_missing" ||
      (typeof err?.message === "string" &&
        err.message.toLowerCase().includes("no such")))
  );
}

export async function POST(request: Request) {
  // 🌐 Always compute origin from request (no env guessing)
  const origin = new URL(request.url).origin;

  // ✅ Stripe secret key presence + mode check (no secret logged)
  const secret = process.env.STRIPE_SECRET_KEY;
  const looksLive = !!secret && secret.startsWith("sk_live_");

  try {
    // 🔒 1) Require a logged-in user
    const session = await getServerSession(authOptions);
    const email = session?.user?.email ?? null;
    const hasSessionEmail = !!email;

    if (!hasSessionEmail) {
      console.log("[portal] unauthorized", {
        origin,
        hasSessionEmail,
        looksLive,
      });
      return jsonError(401, "Unauthorized", { origin, hasSessionEmail, looksLive });
    }

    // 🔎 2) Load user billing identifiers (customer + subscription)
    const user = await prisma.user.findUnique({
      where: { email: email! },
      select: { id: true, stripeCustomerId: true, stripeSubscriptionId: true },
    });

    if (!user) {
      console.log("[portal] user_not_found", {
        origin,
        hasSessionEmail,
        looksLive,
      });
      return jsonError(404, "User not found", { origin, hasSessionEmail, looksLive });
    }

    if (!secret) {
      console.log("[portal] env_missing_secret", {
        origin,
        hasSessionEmail,
        looksLive: false,
        userId: user.id,
      });
      return jsonError(500, "Stripe secret key missing", {
        origin,
        hasSessionEmail,
        looksLive: false,
      });
    }

    const stripe = new Stripe(secret, {
      apiVersion: "2024-06-20",
    });

    const returnUrl = `${origin}/billing`; // keep your current return target

    if (!origin.startsWith("https://")) {
      console.warn("[portal] non_https_origin", { origin, userId: user.id });
    }

    let stripeCustomerId: string | undefined = user.stripeCustomerId || undefined;
    const hasSubscriptionId = !!user.stripeSubscriptionId;

    console.log("[portal] start", {
      origin,
      hasSessionEmail,
      looksLive,
      userId: user.id,
      hasSubscriptionId,
      hasCustomerId: !!stripeCustomerId,
    });

    /**
     * ✅ 4) Never-drift logic:
     * If we have a subscription id, Stripe is the source of truth for customer.
     *
     * ✅ Permanent reliability upgrade:
     * If the stored subscription id is missing/invalid in this Stripe mode,
     * clear it and continue (do NOT brick the billing portal).
     */
    if (user.stripeSubscriptionId) {
      try {
        const sub = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);

        const subCustomerId =
          typeof sub.customer === "string" ? sub.customer : sub.customer?.id;

        if (subCustomerId && subCustomerId !== stripeCustomerId) {
          console.log("[portal] syncing_customer_from_subscription", {
            origin,
            userId: user.id,
            hadCustomerId: !!stripeCustomerId,
            changed: true,
          });

          stripeCustomerId = subCustomerId;

          await prisma.user.update({
            where: { id: user.id },
            data: { stripeCustomerId },
          });
        } else {
          console.log("[portal] subscription_customer_ok", {
            origin,
            userId: user.id,
            changed: false,
          });
        }
      } catch (err: any) {
        if (isStripeMissingResource(err)) {
          // ✅ Self-heal: clear subscription id, keep going.
          console.warn("[portal] subscription_missing_clearing", {
            origin,
            userId: user.id,
            looksLive,
            hadCustomerId: !!stripeCustomerId,
          });

          await prisma.user.update({
            where: { id: user.id },
            data: { stripeSubscriptionId: null },
          });

          // Continue with customer-based portal flow.
          // If customerId is also wrong-mode/missing, step 5 will handle it.
        } else {
          throw err;
        }
      }
    }

    // 🧪 5) If we still have a customer id, verify it exists in this mode
    if (stripeCustomerId) {
      try {
        await stripe.customers.retrieve(stripeCustomerId);
      } catch (err: any) {
        if (isStripeMissingResource(err)) {
          console.warn("[portal] stored_customer_missing", {
            origin,
            userId: user.id,
            looksLive,
          });
          stripeCustomerId = undefined;
        } else {
          throw err;
        }
      }
    }

    // If no customer, create one (your existing behavior)
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: email!,
        metadata: { aeobroUserId: user.id },
      });

      stripeCustomerId = customer.id;

      await prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId },
      });

      console.log("[portal] customer_created", {
        origin,
        userId: user.id,
        looksLive,
      });
    }

    // 6) Create Stripe Billing Portal session
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: returnUrl,
    });

    console.log("[portal] portal_session_created", {
      origin,
      userId: user.id,
      looksLive,
      hasSubscriptionId,
    });

    return NextResponse.json(
      {
        ok: true,
        url: portalSession.url,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("[portal] create_session_failed", {
      origin,
      message: err?.message,
      type: err?.type,
      code: err?.code,
      statusCode: err?.statusCode,
      looksLive,
    });

    return jsonError(500, "Unable to create billing portal session", {
      origin,
      looksLive,
      stripeMessage: err?.message,
      stripeCode: err?.code,
      stripeType: err?.type,
    });
  }
}
