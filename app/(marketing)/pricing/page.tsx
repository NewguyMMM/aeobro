"use client";
import { useState, useCallback } from "react";

const PRICES = {
  LITE: process.env.NEXT_PUBLIC_STRIPE_PRICE_LITE ?? "",
  PRO: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO ?? "",
  BUSINESS: process.env.NEXT_PUBLIC_STRIPE_PRICE_BUSINESS ?? "",
} as const;

type PlanTitle = "Lite" | "Pro" | "Business";

export default function PricingPage() {
  const [loading, setLoading] = useState<PlanTitle | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const startCheckout = useCallback(async (priceId: string, plan: PlanTitle) => {
    setErr(null);

    if (!priceId) {
      setErr(`Missing Stripe Price ID for ${plan}.`);
      return;
    }

    setLoading(plan);
    try {
      // NOTE: ensure this path matches your server route filename
      const res = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId }),
      });

      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("application/json")) {
        throw new Error("Unexpected response (not JSON). Check API route path/guards.");
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Checkout failed.");
      if (!data?.url) throw new Error("No checkout URL returned by server.");

      window.location.href = data.url as string;
    } catch (e: any) {
      console.error("Checkout error:", e);
      setErr(e?.message || "Something went wrong starting checkout.");
      setLoading(null); // restore button instead of sticking on “Redirecting…”
    }
  }, []);

  const PlanCard = ({
    title,
    price,
    features,
    soon = [],
    btnText,
    priceId,
  }: {
    title: PlanTitle;
    price: string;
    features: string[];
    soon?: string[];
    btnText: string;
    priceId: string;
  }) => (
    <div className="rounded-2xl border p-6 flex flex-col gap-4">
      <h3 className="text-xl font-semibold">{title}</h3>
      <div className="text-3xl font-bold">{price}</div>
      <ul className="text-sm space-y-1">
        {features.map((f) => (
          <li key={f}>✅ {f}</li>
        ))}
        {soon.map((f) => (
          <li key={f} className="opacity-70">
            🛠️ {f} — <em>Coming soon</em>
          </li>
        ))}
      </ul>
      <button
        className="btn mt-auto"
        disabled={loading !== null}
        onClick={() => startCheckout(priceId, title)}
      >
        {loading === title ? "Redirecting…" : btnText}
      </button>
    </div>
  );

  return (
    <div className="container py-16">
      {err && (
        <div className="mb-6 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {err}
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        <PlanCard
          title="Lite"
          price="$3.99/mo"
          features={["Person/Creator JSON-LD", "Basic profile (links/images caps)"]}
          btnText="Get Lite"
          priceId={PRICES.LITE}
        />
        <PlanCard
          title="Pro"
          price="$49/mo"
          features={["Organization/LocalBusiness JSON-LD"]}
          soon={["FAQ markup", "Service markup", "Change history"]}
          btnText="Get Pro"
          priceId={PRICES.PRO}
        />
        <PlanCard
          title="Business"
          price="$199/mo"
          features={["Everything in Pro"]}
          soon={["Multi-location (10)", "Team seats (3)", "Bulk import + webhooks", "Advanced analytics"]}
          btnText="Get Business"
          priceId={PRICES.BUSINESS}
        />
      </div>
    </div>
  );
}
