// app/(marketing)/pricing/PricingClient.tsx
"use client";

import { useState } from "react";

// Read public price IDs at build-time; fall back to empty strings so we can
// safely check at runtime without crashing the page.
const PRICES = {
  LITE: process.env.NEXT_PUBLIC_STRIPE_PRICE_LITE ?? "",
  PRO: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO ?? "",
  BUSINESS: process.env.NEXT_PUBLIC_STRIPE_PRICE_BUSINESS ?? "",
} as const;

function isConfigured(priceId: string) {
  return typeof priceId === "string" && priceId.length > 0;
}

async function startCheckout(priceId: string, setLoading: (v: boolean) => void) {
  try {
    if (!isConfigured(priceId)) {
      alert(
        "This plan is not configured yet. Please add the Stripe Price ID to your environment variables."
      );
      return;
    }
    setLoading(true);
    const res = await fetch("/api/stripe/create-checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priceId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.url) throw new Error(data?.error || "Checkout failed");
    window.location.href = data.url; // Stripe-hosted Checkout
  } catch (err) {
    alert((err as Error).message);
  } finally {
    setLoading(false);
  }
}

function Spinner() {
  return (
    <svg
      className="mx-auto h-5 w-5 animate-spin text-white"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

export default function PricingClient() {
  const [loadingLite, setLoadingLite] = useState(false);
  const [loadingPro, setLoadingPro] = useState(false);
  const [loadingBusiness, setLoadingBusiness] = useState(false);

  const liteReady = isConfigured(PRICES.LITE);
  const proReady = isConfigured(PRICES.PRO);
  const businessReady = isConfigured(PRICES.BUSINESS);

  return (
    <main className="container py-16">
      <h1 className="mb-2 text-4xl font-extrabold tracking-tight">Pricing</h1>
      <p className="mb-10 text-gray-600">Pick a plan that matches your identity type.</p>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Lite */}
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h3 className="mb-1 text-xl font-semibold">Lite — $3.99/mo</h3>
          <ul className="my-4 space-y-2 text-sm text-gray-700">
            <li>For creators & individuals</li>
            <li>Verify via YouTube/Google/Instagram/TikTok</li>
            <li>Code-in-bio fallback</li>
            <li>
              Exports: <strong>Person/Creator</strong> JSON-LD
            </li>
            <li>3 links · 1 logo</li>
          </ul>
          {!liteReady && (
            <p className="mb-2 text-[11px] text-red-600">
              Not configured: set <code>NEXT_PUBLIC_STRIPE_PRICE_LITE</code> in Vercel.
            </p>
          )}
          <button
            onClick={() => startCheckout(PRICES.LITE, setLoadingLite)}
            disabled={loadingLite || !liteReady}
            className="flex w-full justify-center rounded-lg bg-black py-3 font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {loadingLite ? <Spinner /> : "Start Lite"}
          </button>
          <p className="mt-2 text-[11px] text-gray-500">Renews monthly. Cancel anytime.</p>
        </div>

        {/* Pro (Most popular) */}
        <div className="scale-[1.02] rounded-2xl border bg-white p-6 shadow-md ring-1 ring-black/5">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-black px-3 py-1 text-xs text-white">
            Most popular
          </div>
          <h3 className="mb-1 text-xl font-semibold">Pro — $49/mo</h3>
          <ul className="my-4 space-y-2 text-sm text-gray-700">
            <li>For official businesses</li>
            <li>Domain verification (DNS or @domain email)</li>
            <li>
              Exports: <strong>Organization/LocalBusiness</strong>
            </li>
            <li>FAQ & Service markup</li>
            <li>10 links + images · Change history</li>
          </ul>
          {!proReady && (
            <p className="mb-2 text-[11px] text-red-600">
              Not configured: set <code>NEXT_PUBLIC_STRIPE_PRICE_PRO</code> in Vercel.
            </p>
          )}
          <button
            onClick={() => startCheckout(PRICES.PRO, setLoadingPro)}
            disabled={loadingPro || !proReady}
            className="flex w-full justify-center rounded-lg bg-black py-3 font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {loadingPro ? <Spinner /> : "Start Pro"}
          </button>
          <p className="mt-2 text-[11px] text-gray-500">Renews monthly. Cancel anytime.</p>
        </div>

        {/* Business */}
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h3 className="mb-1 text-xl font-semibold">Business — $199/mo</h3>
          <ul className="my-4 space-y-2 text-sm text-gray-700">
            <li>All Pro features</li>
            <li>Multi-location (10) & team seats (3)</li>
            <li>Bulk import + webhooks</li>
            <li>Advanced analytics</li>
          </ul>
          {!businessReady && (
            <p className="mb-2 text-[11px] text-red-600">
              Not configured: set <code>NEXT_PUBLIC_STRIPE_PRICE_BUSINESS</code> in Vercel.
            </p>
          )}
          <button
            onClick={() => startCheckout(PRICES.BUSINESS, setLoadingBusiness)}
            disabled={loadingBusiness || !businessReady}
            className="flex w-full justify-center rounded-lg bg-black py-3 font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {loadingBusiness ? <Spinner /> : "Start Business"}
          </button>
          <p className="mt-2 text-[11px] text-gray-500">Renews monthly. Cancel anytime.</p>
        </div>
      </div>

      <div className="mt-12 text-sm text-gray-700">
        <p>
          <strong>Creators (Lite)</strong> verify with a platform handle; <strong>Businesses (Pro+)</strong> verify with a
          domain. Without verification, profiles remain drafts and do not publish externally.
        </p>
      </div>

      <div className="mt-6 text-sm">
        <a href="/faq" className="text-gray-700 underline underline-offset-4 hover:no-underline">
          Questions? Read the FAQ →
        </a>
      </div>
    </main>
  );
}
