'use client';

import { useState } from 'react';

// Read public price IDs at build-time; fall back to empty strings so we can
// safely check at runtime without crashing the page.
const PRICES = {
  LITE: process.env.NEXT_PUBLIC_STRIPE_PRICE_LITE ?? '',
  PRO: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO ?? '',
  BUSINESS: process.env.NEXT_PUBLIC_STRIPE_PRICE_BUSINESS ?? '',
} as const;

function isConfigured(priceId: string) {
  return typeof priceId === 'string' && priceId.length > 0;
}

async function startCheckout(priceId: string, setLoading: (v: boolean) => void) {
  try {
    if (!isConfigured(priceId)) {
      alert('This plan is not configured yet. Please add the Stripe Price ID to your environment variables.');
      return;
    }
    setLoading(true);
    const res = await fetch('/api/stripe/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priceId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.url) throw new Error(data?.error || 'Checkout failed');
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
      className="animate-spin h-5 w-5 text-white mx-auto"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

export default function PricingPage() {
  const [loadingLite, setLoadingLite] = useState(false);
  const [loadingPro, setLoadingPro] = useState(false);
  const [loadingBusiness, setLoadingBusiness] = useState(false);

  const liteReady = isConfigured(PRICES.LITE);
  const proReady = isConfigured(PRICES.PRO);
  const businessReady = isConfigured(PRICES.BUSINESS);

  return (
    <main className="container py-16">
      <h1 className="text-4xl font-extrabold tracking-tight mb-2">Pricing</h1>
      <p className="text-gray-600 mb-10">Pick a plan that matches your identity type.</p>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Lite */}
        <div className="rounded-2xl border p-6 shadow-sm bg-white">
          <h3 className="text-xl font-semibold mb-1">Lite — $3.99/mo</h3>
          <ul className="text-sm text-gray-700 space-y-2 my-4">
            <li>For creators & individuals</li>
            <li>Verify via YouTube/Google/Instagram/TikTok</li>
            <li>Code-in-bio fallback</li>
            <li>Exports: <strong>Person/Creator</strong> JSON-LD</li>
            <li>3 links · 1 logo</li>
          </ul>
          {!liteReady && (
            <p className="text-[11px] text-red-600 mb-2">
              Not configured: set <code>NEXT_PUBLIC_STRIPE_PRICE_LITE</code> in Vercel.
            </p>
          )}
          <button
            onClick={() => startCheckout(PRICES.LITE, setLoadingLite)}
            disabled={loadingLite || !liteReady}
            className="w-full rounded-lg bg-black text-white py-3 font-semibold hover:opacity-90 transition disabled:opacity-60 flex justify-center"
          >
            {loadingLite ? <Spinner /> : 'Start Lite'}
          </button>
          <p className="text-[11px] text-gray-500 mt-2">Renews monthly. Cancel anytime.</p>
        </div>

        {/* Pro (Most popular) */}
        <div className="rounded-2xl border p-6 shadow-md ring-1 ring-black/5 scale-[1.02] bg-white">
          <div className="inline-flex items-center gap-2 rounded-full bg-black text-white text-xs px-3 py-1 mb-3">
            Most popular
          </div>
          <h3 className="text-xl font-s
