// app/(marketing)/cancel/page.tsx
import React from "react";

// ✅ Revalidate hourly (adjust as needed)
export const revalidate = 3600;

// ✅ Metadata (noindex — transactional page)
export const metadata = {
  title: "Checkout canceled — AEOBRO",
  description: "Your checkout was canceled. No charge was made.",
  alternates: { canonical: "/cancel" },
  robots: { index: false, follow: false },
} as const;

export default function CancelPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "Checkout Canceled",
    "url": "https://aeobro.com/cancel",
    "description": "Checkout cancellation confirmation page for AEOBRO."
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://aeobro.com/" },
      { "@type": "ListItem", "position": 2, "name": "Pricing", "item": "https://aeobro.com/pricing" },
      { "@type": "ListItem", "position": 3, "name": "Cancel", "item": "https://aeobro.com/cancel" }
    ]
  };

  return (
    <main className="container py-20">
      {/* JSON-LD */}
      <Script type="application/ld+json" strategy="afterInteractive">
  {JSON.stringify(jsonLd)}
</Script>
      <Script type="application/ld+json" strategy="afterInteractive">
  {JSON.stringify(breadcrumbLd)}
</Script>

      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-4xl font-extrabold tracking-tight">Checkout canceled</h1>
        <p className="text-gray-600 mt-4">
          No worries — your card wasn’t charged. You can try again anytime.
        </p>

        <div className="mt-8 flex items-center justify-center gap-3">
          <a
            href="/pricing"
            className="px-5 py-3 rounded-lg bg-black text-white font-semibold hover:opacity-90"
          >
            Return to Pricing
          </a>
          <a
            href="/"
            className="px-5 py-3 rounded-lg border font-semibold hover:bg-gray-50"
          >
            Go to Home
          </a>
        </div>
      </div>
    </main>
  );
}
