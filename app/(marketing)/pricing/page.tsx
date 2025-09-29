// app/(marketing)/pricing/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

const PRICES = {
  LITE: process.env.NEXT_PUBLIC_STRIPE_PRICE_LITE ?? "",
  PRO: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO ?? "",
  BUSINESS: process.env.NEXT_PUBLIC_STRIPE_PRICE_BUSINESS ?? "",
} as const;

type PlanTitle = "Lite" | "Pro" | "Business";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

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
    // Server route handles auth → Stripe
    return `/checkout?plan=${encodeURIComponent(plan)}&priceId=${encodeURIComponent(priceId)}`;
  }

  // Show the Stripe price-id helper only in dev and only if something's missing
  const showConfigHint = useMemo(() => {
    const missing = !PRICES.LITE || !PRICES.PRO || !PRICES.BUSINESS;
    return process.env.NODE_ENV !== "production" && missing;
  }, []);

  const Button = ({
    children,
    href,
    onClick,
    disabled,
    title,
  }: {
    children: React.ReactNode;
    href?: string;
    onClick?: () => void;
    disabled?: boolean;
    title?: string;
  }) => {
    const base =
      "mt-auto inline-flex h-10 items-center justify-center rounded-xl px-4 py-2 text-center font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500";
    const enabled = "bg-black text-white hover:bg-sky-600";
    const disabledCls = "bg-black/50 text-white/80 cursor-not-allowed";
    if (href && !disabled) {
      return (
        <a href={href} className={cx(base, enabled)} onClick={onClick}>
          {children}
        </a>
      );
    }
    return (
      <button
        className={cx(base, disabled ? disabledCls : enabled)}
        disabled={disabled}
        title={title}
        onClick={onClick}
      >
        {children}
      </button>
    );
  };

  const PlanCard = ({
    title,
    price,
    features,
    soon = [],
    btnText,
    priceId,
    featured = false,
  }: {
    title: PlanTitle;
    price: string;
    features: string[];
    soon?: string[];
    btnText: string;
    priceId: string;
    featured?: boolean;
  }) => {
    const disabled = !priceId;

    return (
      <div
        className={cx(
          "relative flex flex-col gap-4 rounded-2xl border p-6 shadow-sm",
          featured && "border-sky-500/40 shadow-md"
        )}
      >
        {featured && (
          <div className="absolute -top-4 left-6 rounded-full bg-sky-600 px-3 py-1 text-xs font-semibold text-white shadow">
            Most Popular
          </div>
        )}

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
          <Button
            disabled
            title={`Missing Stripe Price ID for ${title}.`}
            onClick={() => setErr(`Missing Stripe Price ID for ${title}.`)}
          >
            {btnText}
          </Button>
        ) : (
          <Button href={hrefFor(title, priceId)} onClick={() => setLoading(title)}>
            {loading === title ? "Redirecting…" : btnText}
          </Button>
        )}
      </div>
    );
  };

  return (
    {/* Extra top padding for more space under header; a bit more bottom too */}
    <div className="container pt-28 pb-20">
      {err && (
        <div className="mb-6 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {err}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-3">
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
          featured
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

      {showConfigHint && (
        <p className="mt-4 text-sm text-gray-500">
          If a plan button is disabled, add the corresponding Stripe Price ID to your environment variables.
        </p>
      )}
    </div>
  );
}
