// app/(marketing)/pricing/page.tsx
"use client";

import { useEffect, useMemo, useState, useCallback } from "react";

const PRICES = {
  LITE: process.env.NEXT_PUBLIC_STRIPE_PRICE_LITE ?? "",
  PLUS: process.env.NEXT_PUBLIC_STRIPE_PRICE_PLUS ?? "",       // ✅ NEW: Plus wired to env
  PRO: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO ?? "",
  BUSINESS: process.env.NEXT_PUBLIC_STRIPE_PRICE_BUSINESS ?? "",
} as const;

type PlanTitle = "Lite" | "Plus" | "Pro" | "Business";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

/* ------------------------ UI helpers ------------------------ */

function Tooltip({
  children,
  text,
  align = "left",
}: {
  children: React.ReactNode;
  text: string;
  align?: "left" | "right";
}) {
  return (
    <span
      className="relative inline-flex items-center group focus:outline-none"
      tabIndex={0}
      aria-label={text}
    >
      {children}
      <span
        className={cx(
          "pointer-events-none absolute z-20 mt-2 hidden max-w-xs w-[280px] rounded-lg border bg-white p-3 text-xs leading-relaxed text-gray-700 shadow-lg",
          "group-hover:block group-focus:block",
          align === "left" ? "left-0 top-full" : "right-0 top-full"
        )}
        role="tooltip"
      >
        {text}
      </span>
    </span>
  );
}

function FeatureLine({
  label,
  tooltip,
  variant = "check",
  comingSoon = false,
}: {
  label: string;
  tooltip: string;
  variant?: "check" | "wrench";
  comingSoon?: boolean;
}) {
  const icon = variant === "check" ? "✅" : "🛠️";
  return (
    <li className={cx("text-sm", comingSoon && "opacity-70")}>
      <Tooltip text={tooltip}>
        <span className="inline-flex items-start gap-2">
          <span aria-hidden="true">{icon}</span>
          <span>
            {label}
            {comingSoon && (
              <>
                {" "}
                — <em>Coming soon</em>
              </>
            )}
          </span>
        </span>
      </Tooltip>
    </li>
  );
}

/* ------------------------ Page ------------------------ */

export default function PricingPage() {
  const [loading, setLoading] = useState<PlanTitle | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Auto-resume checkout after sign-in if URL has ?start=<priceId>&plan=<PlanTitle>
  useEffect(() => {
    const url = new URL(window.location.href);
    const priceId = url.searchParams.get("start");
    const plan = url.searchParams.get("plan") as PlanTitle | null;

    if (priceId && plan) {
      url.searchParams.delete("start");
      url.searchParams.delete("plan");
      const clean =
        url.pathname + (url.searchParams.toString() ? `?${url.searchParams}` : "");
      window.history.replaceState({}, "", clean);
      startCheckout(priceId, plan);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const reset = () => setLoading(null);
    window.addEventListener("pageshow", reset);
    window.addEventListener("focus", reset);
    return () => {
      window.removeEventListener("pageshow", reset);
      window.removeEventListener("focus", reset);
    };
  }, []);

  const startCheckout = useCallback(async (priceId: string, plan: PlanTitle) => {
    setErr(null);

    if (!priceId) {
      setErr(`Missing Stripe Price ID for ${plan}.`);
      return;
    }

    try {
      setLoading(plan);
      const res = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId }),
      });

      if (res.status === 401) {
        const callbackUrl = new URL(window.location.href);
        callbackUrl.searchParams.set("start", priceId);
        callbackUrl.searchParams.set("plan", plan);
        const signin = new URL("/api/auth/signin", window.location.origin);
        signin.searchParams.set("callbackUrl", callbackUrl.toString());
        window.location.assign(signin.toString());
        return;
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to start checkout.");
      if (!data?.url) throw new Error("Server did not return a checkout URL.");

      window.location.assign(data.url as string);
    } catch (e: any) {
      setErr(e?.message || "Something went wrong.");
      setLoading(null);
    }
  }, []);

  const showConfigHint = useMemo(() => {
    // ✅ Include PLUS in dev hint so you see if its env is missing
    const missing = !PRICES.LITE || !PRICES.PLUS || !PRICES.PRO || !PRICES.BUSINESS;
    return process.env.NODE_ENV !== "production" && missing;
  }, []);

  const Button = ({
    children,
    onClick,
    disabled,
    title,
    variant = "primary",
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    title?: string;
    variant?: "primary" | "disabled";
  }) => {
    const base =
      "mt-auto inline-flex h-10 items-center justify-center rounded-xl px-4 py-2 text-center font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500";
    const enabled = "bg-black text-white hover:bg-sky-600";
    const disabledCls = "bg-neutral-200 text-neutral-500 cursor-not-allowed";

    const isDisabled = disabled || variant === "disabled";

    return (
      <button
        className={cx(base, isDisabled ? disabledCls : enabled)}
        disabled={isDisabled}
        title={title}
        onClick={isDisabled ? undefined : onClick}
      >
        {children}
      </button>
    );
  };

  type FeatureSpec = { label: string; tooltip: string };

  const PlanCard = ({
    title,
    price,
    bestFor,
    features,
    soon = [],
    btnText,
    priceId,
    featured = false,
    comingSoon = false, // forces disabled + gray highlight
  }: {
    title: PlanTitle;
    price: string;
    bestFor: string;
    features: FeatureSpec[];
    soon?: FeatureSpec[];
    btnText: string;
    priceId: string;
    featured?: boolean;
    comingSoon?: boolean;
  }) => {
    const disabled = comingSoon || !priceId;

    return (
      <div
        className={cx(
          "relative flex flex-col gap-4 rounded-2xl p-6 shadow-sm border",
          featured && "border-sky-500/40 shadow-md",
          comingSoon ? "bg-neutral-50 border-neutral-200" : "bg-white"
        )}
      >
        {featured && (
          <div className="absolute -top-2 md:-top-3 left-6 rounded-full bg-sky-600 px-3 py-1 text-xs font-semibold text-white shadow">
            Most Popular
          </div>
        )}

        <h3 className="text-xl font-semibold">{title}</h3>
        <div className="text-3xl font-bold">{price}</div>

        {/* Best for … */}
        <p className="text-sm text-gray-700 -mt-2">
          <span className="font-medium">Best for:</span> {bestFor}
        </p>

        <ul className="space-y-1">
          {features.map((f) => (
            <FeatureLine
              key={f.label}
              label={f.label}
              tooltip={f.tooltip}
              variant="check"
            />
          ))}
          {soon.map((f) => (
            <FeatureLine
              key={f.label}
              label={f.label}
              tooltip={f.tooltip}
              variant="wrench"
              comingSoon
            />
          ))}
        </ul>

        <Button
          disabled={!comingSoon && !priceId ? true : false}
          variant={comingSoon ? "disabled" : "primary"}
          title={
            comingSoon
              ? "This tier is coming soon."
              : !priceId
              ? `Missing Stripe Price ID for ${title}.`
              : undefined
          }
          onClick={
            comingSoon || !priceId ? undefined : () => startCheckout(priceId, title)
          }
        >
          {loading === title ? "Redirecting…" : comingSoon ? "Coming soon" : btnText}
        </Button>
      </div>
    );
  };

  /* ------------------------ Feature content ------------------------ */

  const CENTRALIZED_TOOLTIP =
    "You get a basic, centralized AI-ready profile with your business/creator name, logo, links, and a capped number of images/links. This is like having a business card for machines — enough for AI and search engines to know who you are and where to find you. But: no advanced schema types (FAQ, Services, Reviews, etc.) and no audit trail.";

  const UPDATES_TOOLTIP =
    "Publish quick, structured updates (e.g., posts, announcements, listings, events) that AI can index — ideal for frequent changes like new inventory, listings, or promos.";

  const FAQ_TOOLTIP =
    "Beyond just listing a tagline, you can build a structured Q&A section AI can read.";

  const SERVICE_TOOLTIP =
    "Not just “We do photography,” but “We offer wedding packages, family sessions, pricing ranges, etc.” in schema format.";

  const MULTI_LOCATION_TOOLTIP =
    "Manage up to 10 locations under one account—each with its own hours, address, and phone—published in structured data.";

  const TEAM_SEATS_TOOLTIP =
    "Invite up to 3 teammates to edit and publish without sharing a login.";

  const BULK_WEBHOOKS_TOOLTIP =
    "Upload many items at once and notify your other apps automatically when you publish or update.";

  const ANALYTICS_TOOLTIP =
    "See how often your structured data appears in AI answers/search and which items drive visibility.";

  return (
    <div className="container pt-24 pb-16">
      {err && (
        <div className="mb-6 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {err}
        </div>
      )}

      {/* Four cards now – include Plus */}
      <div className="grid gap-6 md:grid-cols-4 mt-2">
        {/* Lite */}
        <PlanCard
          title="Lite"
          price="$4.99/mo"
          bestFor="individuals, creators, or small teams who want a simple, AI-ready profile without extras."
          features={[{ label: "Centralized AI Ready Profile", tooltip: CENTRALIZED_TOOLTIP }]}
          btnText="Get Lite"
          priceId={PRICES.LITE}
        />

        {/* Plus (now active, not coming soon) */}
        <PlanCard
          title="Plus"
          price="$19.99/mo"
          bestFor="For brands that are growing and already engage in frequent updates to social media, have calendar updates, retailers with upcoming sales promotions."
          features={[
            { label: "Centralized AI Ready Profile", tooltip: CENTRALIZED_TOOLTIP },
            { label: "Updates", tooltip: UPDATES_TOOLTIP },
          ]}
          btnText="Get Plus"
          priceId={PRICES.PLUS}      // ✅ uses env price; button auto-disables if missing
        />

        {/* Pro (Most Popular) */}
        <PlanCard
          title="Pro"
          price="$49/mo"
          bestFor="professionals, small businesses, and product brands looking for richer AI visibility with FAQs, services, and updates."
          features={[
            { label: "Centralized AI Ready Profile", tooltip: CENTRALIZED_TOOLTIP },
            { label: "Updates", tooltip: UPDATES_TOOLTIP },
            { label: "FAQ markup", tooltip: FAQ_TOOLTIP },
            { label: "Service markup", tooltip: SERVICE_TOOLTIP },
          ]}
          soon={[]}
          btnText="Get Pro"
          priceId={PRICES.PRO}
          featured
        />

        {/* Business (Coming soon) */}
        <PlanCard
          title="Business"
          price="$199/mo"
          bestFor="agencies, multi-location companies, or organizations that need collaboration, scale, and advanced tools."
          features={[{ label: "Everything in Pro", tooltip: "Includes all Pro features." }]}
          soon={[
            { label: "Multi-location (10)", tooltip: MULTI_LOCATION_TOOLTIP },
            { label: "Team seats (3)", tooltip: TEAM_SEATS_TOOLTIP },
            { label: "Bulk import + webhooks", tooltip: BULK_WEBHOOKS_TOOLTIP },
            { label: "Advanced analytics", tooltip: ANALYTICS_TOOLTIP },
          ]}
          btnText="Coming soon"
          priceId=""           // intentionally blank; tier disabled
          comingSoon
        />
      </div>

      {showConfigHint && (
        <p className="mt-4 text-sm text-gray-500">
          If a plan button is disabled due to configuration, add the corresponding Stripe Price ID to your environment variables.
          (Note: some tiers are intentionally marked “Coming soon.”)
        </p>
      )}
    </div>
  );
}
