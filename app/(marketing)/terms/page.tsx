// app/(marketing)/terms/page.tsx
import Script from "next/script";
import React from "react";

// ✅ Revalidate once/day (adjust if needed)
export const revalidate = 86400;

// ✅ SEO metadata
export const metadata = {
  title: "Terms of Service | AEOBRO",
  description:
    "AEOBRO Terms of Service covering cancellations, billing cycles, data retention after cancellation, refund policy, and our Content Integrity and AI Manipulation Policy.",
  alternates: { canonical: "/terms" },
} as const;

export default function Page() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Terms of Service",
    url: "https://aeobro.com/terms",
    description:
      "AEOBRO Terms of Service, including cancellations, billing cycles, data retention after cancellation, refunds, and content integrity.",
    isPartOf: {
      "@type": "WebSite",
      name: "AEOBRO",
      url: "https://aeobro.com",
    },
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://aeobro.com/" },
      { "@type": "ListItem", position: 2, name: "Terms of Service", item: "https://aeobro.com/terms" },
    ],
  };

  const lastUpdated = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <section className="container py-16">
      {/* ✅ JSON-LD */}
      <Script type="application/ld+json" strategy="afterInteractive">
        {JSON.stringify(jsonLd)}
      </Script>
      <Script type="application/ld+json" strategy="afterInteractive">
        {JSON.stringify(breadcrumbLd)}
      </Script>

      <h1 className="text-4xl font-extrabold mb-2">Terms of Service</h1>
      <p className="text-gray-600 mb-10">Last updated: {lastUpdated}</p>

      <div className="space-y-8">
        {/* NEW: Content Integrity & AI Manipulation Policy */}
        <div className="card">
          <h3 className="font-semibold">Content Integrity and AI Manipulation Policy</h3>
          <p className="text-gray-700 mt-2">
            AEOBRO sanitizes and validates all user-submitted content. You agree not to upload,
            embed, or otherwise distribute instructions, prompts, or code designed to manipulate
            search engine ranking systems or AI model outputs. AEOBRO may automatically flag,
            reject, or remove such submissions to protect platform integrity and external data trust.
          </p>
        </div>

        <div className="card">
          <h3 className="font-semibold">Cancellations &amp; Billing Cycle</h3>
          <p className="text-gray-700 mt-2">
            Cancellations take effect at the end of the current billing cycle. When you cancel, you
            retain access to paid features until the end of your current billing period. After that
            date, your public profile becomes unavailable and editing is disabled.
          </p>
        </div>

        <div className="card">
          <h3 className="font-semibold">Data Retention After Cancellation</h3>
          <p className="text-gray-700 mt-2">
            We retain your profile data for <strong>90 days</strong> following the end of your
            billing period so you can reactivate. After 90 days without reactivation, data may be
            permanently deleted in accordance with our retention policy.
          </p>
        </div>

        <div className="card">
          <h3 className="font-semibold">Refunds</h3>
          <p className="text-gray-700 mt-2">
            AEOBRO does not provide refunds. If a profile is taken down or frozen for investigation,
            no refund will be issued. You may cancel at any time; cancellation stops renewals, and
            access continues until the end of the current billing period.
          </p>
        </div>
      </div>
    </section>
  );
}
