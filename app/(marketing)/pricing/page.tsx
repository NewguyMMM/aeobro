// app/(marketing)/pricing/page.tsx
"use client";

import { useEffect, useState } from "react";

const PRICES = {
  LITE: process.env.NEXT_PUBLIC_STRIPE_PRICE_LITE ?? "",
  PRO: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO ?? "",
  BUSINESS: process.env.NEXT_PUBLIC_STRIPE_PRICE_BUSINESS ?? "",
} as const;

type PlanTitle = "Lite" | "Pro" | "Business";

export default function PricingPage() {
  const [loading, setLoading] = useState<PlanTitle | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Clear "Redirecting…" if user navigates back from Stripe or refocuses the tab
  useEffect(() => {
    const reset = () => setLoading(null);
    window.addEventListener("pageshow", reset);
    window.addEventListener("focus", reset);
    return () => {
      window.removeEventListener("pageshow", reset);
      window.removeEventListener("focus", reset);
    };
  }, []);

  function hrefFor(plan: PlanTitle, priceId: string) {
    if (!priceId) return "#";
    // Server route will handle: if not signed in -> NextAuth email; else -> Stripe Checkout
    return `/checkout?plan=${encodeURIComponent(plan)}&priceId=${encodeURIComponent(priceId)}`;
  }

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
  }) => {
    const disabled = !priceId;

    return (
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

        {disabled ? (
          <button
            className="btn mt-auto opacity-50 pointer-events-none"
            aria-disabled
            title={`Missing Stripe Price ID for ${title}.`}
            onClick={() => setErr(`Missing Stripe Price ID for ${title}.`)}
          >
            {btnText}
          </button>
        ) : (
          <a
            href={hrefFor(title, priceId)}
            className="btn mt-auto"
            onClick={() => setLoading(title)}
          >
            {loading === title ? "Redirecting…" : btnText}
          </a>
        )}
      </div>
    );
  };

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
          soon={[
            "Multi-location (10)",
            "Team seats (3)",
            "Bulk import + webhooks",
            "Advanced analytics",
          ]}
          btnText="Get Business"
          priceId={PRICES.BUSINESS}
        />
      </div>

      <p className="text-sm text-gray-500 mt-4">
        If a plan button is disabled, add the corresponding Stripe Price ID to your environment variables.
      </p>
    </div>
  );
}
