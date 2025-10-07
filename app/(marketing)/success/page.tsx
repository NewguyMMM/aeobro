// app/(marketing)/success/page.tsx
import React from "react";

// ✅ Revalidate hourly (adjust as needed)
export const revalidate = 3600;

// ✅ Metadata (noindex — transactional page)
export const metadata = {
  title: "Success — AEOBRO",
  description: "Your AEOBRO subscription is active. Head to your dashboard to finish setup.",
  alternates: { canonical: "/success" },
  robots: { index: false, follow: false }, // prevent indexing
} as const;

export default function SuccessPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "Checkout Success",
    "url": "https://aeobro.com/success",
    "description": "Confirmation page after successful AEOBRO checkout."
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://aeobro.com/" },
      { "@type": "ListItem", "position": 2, "name": "Pricing", "item": "https://aeobro.com/pricing" },
      { "@type": "ListItem", "position": 3, "name": "Success", "item": "https://aeobro.com/success" }
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
        <h1 className="text-4xl font-extrabold tracking-tight">✅ Payment successful</h1>
        <p className="text-gray-600 mt-4">
          Thanks for subscribing to AEOBRO. Your plan is active.
        </p>

        <div className="mt-8 flex items-center justify-center gap-3">
          <a
            href="/dashboard"
            className="px-5 py-3 rounded-lg bg-black text-white font-semibold hover:opacity-90"
          >
            Go to Dashboard
          </a>
          <a
            href="/pricing"
            className="px-5 py-3 rounded-lg border font-semibold hover:bg-gray-50"
          >
            Back to Pricing
          </a>
        </div>

        <p className="text-xs text-gray-500 mt-6">
          If you don’t see your subscription right away, refresh the page. If it’s still missing,
          it may take a moment for Stripe to confirm the event — then your dashboard will reflect the plan.
        </p>
      </div>
    </main>
  );
}

