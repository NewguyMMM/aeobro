'use client';

import { useState } from 'react';

const PRICES = {
  LITE: process.env.NEXT_PUBLIC_STRIPE_PRICE_LITE!,
  PRO: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO!,
  // You can add BUSINESS/ENTERPRISE price IDs here later if you decide to self-serve those
};

async function startCheckout(priceId: string, setLoading: (v: boolean) => void) {
  try {
    setLoading(true);
    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priceId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Checkout failed');
    // Redirect to Stripe-hosted checkout
    window.location.href = data.url;
  } catch (err) {
    alert((err as Error).message);
  } finally {
    setLoading(false);
  }
}

export default function PricingPage() {
  const [loadingLite, setLoadingLite] = useState(false);
  const [loadingPro, setLoadingPro] = useState(false);

  return (
    <main className="container py-16">
      <h1 className="text-4xl font-extrabold tracking-tight mb-2">Pricing</h1>
      <p className="text-gray-600 mb-10">Pick a plan that grows with you.</p>

      <div className="grid gap-6 md:grid-cols-4">
        {/* Lite */}
        <div className="rounded-2xl border p-6 shadow-sm">
          <h3 className="text-xl font-semibold mb-1">Lite — $3.99/mo</h3>
          <ul className="text-sm text-gray-700 space-y-2 my-4">
            <li>1 profile</li>
            <li>Basic Score</li>
            <li>3 links</li>
            <li>1 logo</li>
            <li>No verification badge</li>
            <li>“Powered by AEOBRO” badge</li>
          </ul>
          <button
            onClick={() => startCheckout(PRICES.LITE, setLoadingLite)}
            disabled={loadingLite}
            className="w-full rounded-lg bg-black text-white py-3 font-semibold hover:opacity-90 transition disabled:opacity-60"
          >
            {loadingLite ? 'Starting…' : 'Start Lite'}
          </button>
          <p className="text-[11px] text-gray-500 mt-2">Renews monthly. Cancel anytime.</p>
        </div>

        {/* Pro (Most popular) */}
        <div className="rounded-2xl border p-6 shadow-md ring-1 ring-black/5 scale-[1.02]">
          <div className="inline-flex items-center gap-2 rounded-full bg-black text-white text-xs px-3 py-1 mb-3">
            Most popular
          </div>
          <h3 className="text-xl font-semibold mb-1">Pro — $49/mo</h3>
          <ul className="text-sm text-gray-700 space-y-2 my-4">
            <li>Full JSON-LD + FAQ/QAPage</li>
            <li>Verification badge</li>
            <li>Change history</li>
            <li>10 links + images</li>
            <li>API read</li>
          </ul>
          <button
            onClick={() => startCheckout(PRICES.PRO, setLoadingPro)}
            disabled={loadingPro}
            className="w-full rounded-lg bg-black text-white py-3 font-semibold hover:opacity-90 transition disabled:opacity-60"
          >
            {loadingPro ? 'Starting…' : 'Upgrade to Pro'}
          </button>
          <p className="text-[11px] text-gray-500 mt-2">Renews monthly. Cancel anytime.</p>
        </div>

        {/* Business */}
        <div className="rounded-2xl border p-6 shadow-sm">
          <h3 className="text-xl font-semibold mb-1">Business — $199/mo</h3>
          <ul className="text-sm text-gray-700 space-y-2 my-4">
            <li>Multi-location (10)</li>
            <li>Team seats (3)</li>
            <li>Bulk import + webhooks</li>
            <li>Advanced analytics</li>
          </ul>
          <a
            href="/contact?plan=business"
            className="w-full inline-flex justify-center rounded-lg border py-3 font-semibold hover:bg-gray-50"
          >
            Talk to sales
          </a>
          <p className="text-[11px] text-gray-500 mt-2">Custom onboarding available.</p>
        </div>

        {/* Enterprise */}
        <div className="rounded-2xl border p-6 shadow-sm">
          <h3 className="text-xl font-semibold mb-1">Enterprise — $1000+/mo</h3>
          <ul className="text-sm text-gray-700 space-y-2 my-4">
            <li>Unlimited locations</li>
            <li>SSO, SLA, custom schema</li>
            <li>Dedicated subdomain</li>
          </ul>
          <a
            href="/contact?plan=enterprise"
            className="w-full inline-flex justify-center rounded-lg bg-black text-white py-3 font-semibold hover:opacity-90"
          >
            Contact us
          </a>
          <p className="text-[11px] text-gray-500 mt-2">Let’s scope your requirements.</p>
        </div>
      </div>

      {/* FAQ jump */}
      <div className="mt-12 text-sm">
        <a href="/faq" className="text-gray-700 underline underline-offset-4 hover:no-underline">
          Questions? Read the FAQ →
        </a>
      </div>
    </main>
  );
}
