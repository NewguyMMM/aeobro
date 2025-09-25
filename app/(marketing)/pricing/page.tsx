"use client";
import { useState } from "react";

const PRICES = {
  LITE: process.env.NEXT_PUBLIC_STRIPE_PRICE_LITE!,
  PRO: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO!,
  BUSINESS: process.env.NEXT_PUBLIC_STRIPE_PRICE_BUSINESS!,
};

async function startCheckout(priceId: string, setLoading: (b: boolean) => void) {
  setLoading(true);
  const res = await fetch("/api/stripe/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ priceId }),
  });
  const data = await res.json();
  setLoading(false);
  if (data?.url) window.location.href = data.url;
  else alert("Checkout failed.");
}

export default function PricingPage() {
  const [loading, setLoading] = useState<string | null>(null);

  const PlanCard = ({
    title,
    price,
    features,
    btnText,
    priceId,
    soon = [],
  }: {
    title: string;
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
          <li key={f} className="opacity-70">🛠️ {f} — <em>Coming soon</em></li>
        ))}
      </ul>
      <button
        className="btn mt-auto"
        disabled={loading === title}
        onClick={() => startCheckout(priceId, (v) => setLoading(v ? title : null))}
      >
        {loading === title ? "Redirecting…" : btnText}
      </button>
    </div>
  );

  return (
    <div className="container py-16 grid md:grid-cols-3 gap-6">
      <PlanCard
        title="Lite"
        price="$3.99/mo"
        features={[
          "Person/Creator JSON-LD",
          "Basic profile (links/images caps)",
        ]}
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
  );
}
