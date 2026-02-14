// app/(marketing)/pricing/page.tsx
"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import ManageBillingButton from "@/components/stripe/ManageBillingButton";

/**
 * ✅ IMPORTANT:
 * Do NOT hardcode fallback Stripe price IDs here.
 * If env vars are missing, we surface a clear UI hint + disable buttons.
 */
const PRICES = {
  LITE: process.env.NEXT_PUBLIC_STRIPE_PRICE_LITE ?? "",
  PLUS: process.env.NEXT_PUBLIC_STRIPE_PRICE_PLUS ?? "",
  // PRO intentionally retained for backend/hidden tier use (not shown in UI)
  PRO: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO ?? "",
} as const;

type PlanTitle = "Lite" | "Plus";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

/* ------------------------ Plan helpers ------------------------ */

function normalizePlanForUi(raw?: string | null): PlanTitle {
  const v = (raw ?? "").toString().toUpperCase();
  switch (v) {
    case "PLUS":
      return "Plus";
    // ✅ Pro users are classified as Plus (UI)
    case "PRO":
      return "Plus";
    // Treat FREE, LITE, and unknown as Lite
    case "LITE":
    case "FREE":
    default:
      return "Lite";
  }
}

function formatStatusLabel(status?: string | null) {
  const v = (status ?? "").toUpperCase();

  if (v === "TRIALING") return "Trialing";
  if (v === "PAST_DUE") return "Past due";
  if (v === "INCOMPLETE" || v === "INCOMPLETE_EXPIRED")
    return "Payment incomplete";
  if (v === "UNPAID") return "Unpaid";
  if (v === "CANCELED") return "Canceled";
  if (v === "ACTIVE" || !v) return "Active";

  return v.charAt(0) + v.slice(1).toLowerCase();
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

  // Current user plan (for logged-in users)
  const [currentPlan, setCurrentPlan] = useState<PlanTitle | null>(null);
  const [planStatus, setPlanStatus] = useState<string | null>(null);
  const [planLoading, setPlanLoading] = useState(true);

  // Fetch plan for logged-in users
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/account", { cache: "no-store" });
        if (!res.ok) {
          // 401 when logged out, or other errors – silently ignore
          return;
        }
        const data = await res.json();
        const rawPlan = data?.plan as string | undefined;
        const rawStatus =
          (data?.planStatus as string | undefined) ??
          (data?.subscriptionStatus as string | undefined);

        if (!cancelled && rawPlan) {
          setCurrentPlan(normalizePlanForUi(rawPlan));
        }
        if (!cancelled && rawStatus) {
          setPlanStatus(rawStatus);
        }
      } catch {
        // ignore; pricing still works fine without this
      } finally {
        if (!cancelled) setPlanLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

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
    // ✅ Only require Lite + Plus for dev hint
    const missing = !PRICES.LITE || !PRICES.PLUS;
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
    btnText,
    priceId,
    featured = false,
  }: {
    title: PlanTitle;
    price: string;
    bestFor: string;
    features: FeatureSpec[];
    btnText: string;
    priceId: string;
    featured?: boolean;
  }) => {
    const disabled = !priceId;

    return (
      <div
        className={cx(
          "relative flex flex-col gap-4 rounded-2xl p-6 shadow-sm border bg-white",
          featured && "border-sky-500/40 shadow-md"
        )}
      >
        {featured && (
          <div className="absolute -top-2 md:-top-3 left-6 rounded-full bg-sky-600 px-3 py-1 text-xs font-semibold text-white shadow">
            Most Popular
          </div>
        )}

        <h3 className="text-xl font-semibold">{title}</h3>
        <div className="text-3xl font-bold">{price}</div>

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
        </ul>

        <Button
          disabled={!priceId}
          title={!priceId ? `Missing Stripe Price ID for ${title}.` : undefined}
          onClick={!priceId ? undefined : () => startCheckout(priceId, title)}
        >
          {loading === title ? "Redirecting…" : btnText}
        </Button>
      </div>
    );
  };

  /* ------------------------ Feature content ------------------------ */

  const CENTRALIZED_TOOLTIP =
    "You get a basic, centralized AI-ready profile with your business/creator name, logo, links, and a capped number of images/links. This is like having a business card for machines — enough for AI and search engines to know who you are and where to find you.";

  const UPDATES_TOOLTIP =
    "Publish quick, structured updates (e.g., posts, announcements, listings, events) that AI can index — ideal for frequent changes like new inventory, listings, or promos.";

  const PRODUCTS_TOOLTIP =
    "Products/Catalog turns what you sell into structured data — not just a link — so AI can interpret details like name, price, category, and availability, then compare and surface your offerings more accurately.";

  const FAQ_TOOLTIP =
    "Publish common questions and answers in schema.org format. This helps AI assistants retrieve accurate responses to routine questions.";

  const SERVICE_TOOLTIP =
    "Structured data describing offerings, service areas, and attributes. This helps AI systems understand what you do in a more precise way.";

  return (
    <div className="container pt-24 pb-16">
      {!planLoading && currentPlan && (
        <section className="mb-6 rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between md:gap-4">
          <div>
            <p className="text-sm text-sky-900">
              You&apos;re currently on the{" "}
              <span className="font-semibold">{currentPlan}</span> plan.
            </p>
            {planStatus && (
              <p className="mt-0.5 text-xs text-sky-800/80">
                Status: {formatStatusLabel(planStatus)}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <ManageBillingButton />
          </div>
        </section>
      )}

      {err && (
        <div className="mb-6 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {err}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2 mt-2">
        <PlanCard
          title="Lite"
          price="$9.99/mo"
          bestFor="individuals, creators, or small teams who want a simple, AI-ready profile."
          features={[
            { label: "Centralized AI Ready Profile", tooltip: CENTRALIZED_TOOLTIP },
          ]}
          btnText="Get Lite"
          priceId={PRICES.LITE}
        />

        <PlanCard
          title="Plus"
          price="$29.99/mo"
          bestFor="brands and businesses that want richer AI understanding with structured products, updates, FAQs, and services."
          features={[
            { label: "Centralized AI Ready Profile", tooltip: CENTRALIZED_TOOLTIP },
            { label: "Products / Catalog", tooltip: PRODUCTS_TOOLTIP },
            { label: "Updates", tooltip: UPDATES_TOOLTIP },
            { label: "FAQ markup", tooltip: FAQ_TOOLTIP },
            { label: "Service markup", tooltip: SERVICE_TOOLTIP },
          ]}
          btnText="Get Plus"
          priceId={PRICES.PLUS}
          featured
        />
      </div>

      {showConfigHint && (
        <p className="mt-4 text-sm text-gray-500">
          If a plan button is disabled due to configuration, add the corresponding
          Stripe Price ID to your environment variables. (Note: some tiers may be
          intentionally hidden.)
        </p>
      )}
    </div>
  );
}
