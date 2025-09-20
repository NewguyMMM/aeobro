// app/(marketing)/disputes/page.tsx
import React from "react";

// ✅ Revalidate once/day (marketing policy page)
export const revalidate = 86400;

// ✅ SEO metadata
export const metadata = {
  title: "Disputes & Impersonation | AEOBRO",
  description:
    "How AEOBRO handles identity disputes and impersonation claims. Learn the verification steps (DNS, file, or domain email), temporary removals, evidence requirements, and outcomes.",
  alternates: { canonical: "/disputes" },
} as const;

export default function DisputesPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "Disputes & Impersonation",
    "url": "https://aeobro.com/disputes",
    "description":
      "AEOBRO’s process for handling identity disputes and impersonation claims, including verification methods and enforcement actions.",
    "isPartOf": {
      "@type": "WebSite",
      "name": "AEOBRO",
      "url": "https://aeobro.com"
    }
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://aeobro.com/" },
      { "@type": "ListItem", "position": 2, "name": "Disputes & Impersonation", "item": "https://aeobro.com/disputes" }
    ]
  };

  return (
    <section className="container py-16 prose max-w-3xl">
      {/* ✅ JSON-LD */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />

      <h1 className="text-4xl font-extrabold mb-2">Disputes &amp; Impersonation</h1>
      <p className="text-gray-600 mb-8">
        Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
      </p>

      <p>
        AEOBRO publishes verified, machine-readable profiles. When a dispute about ownership or an
        impersonation claim is made, we may request additional verification and may temporarily
        remove or unpublish the disputed profile or its structured data while we review.
      </p>

      <h2>What We May Request</h2>
      <ul>
        <li>
          <strong>DNS TXT verification (preferred):</strong> Add a TXT record under the claimed domain.
        </li>
        <li>
          <strong>File verification:</strong> Upload a provided HTML file at a specific path on the claimed domain.
        </li>
        <li>
          <strong>Domain email confirmation:</strong> Send/receive from an address like{" "}
          <code className="px-1 rounded bg-gray-100">you@yourcompany.com</code>.
        </li>
        <li>
          <strong>Platform proof (Lite):</strong> OAuth login and/or a short “code-in-bio” placed on an official handle.
        </li>
      </ul>

      <h2>During a Dispute</h2>
      <ul>
        <li>
          <strong>Temporary unpublishing:</strong> Disputed pages may be temporarily removed from public view and from
          structured-data exports while we verify ownership and authenticity.
        </li>
        <li>
          <strong>Caching effects:</strong> Search/AI systems may retain cached data for a time; this is outside of AEOBRO’s control.
        </li>
        <li>
          <strong>Communication:</strong> We may contact both parties for supplemental evidence.
        </li>
      </ul>

      <h2>Evidence We Consider</h2>
      <ul>
        <li>Domain-level control (DNS, file, or domain email).</li>
        <li>Business registration or equivalent documentation (if applicable).</li>
        <li>Platform handle control and public bios/links consistent with the claim.</li>
        <li>Historical use of marks/names and risk of confusion for the public.</li>
      </ul>

      <h2>Outcomes</h2>
      <ul>
        <li>
          <strong>Restoration:</strong> The original page is restored if ownership is verified.
        </li>
        <li>
          <strong>Transfer:</strong> The page may be transferred to the verified owner when sufficient proof is provided.
        </li>
        <li>
          <strong>Removal:</strong> Pages that cannot be verified or that violate policy may be removed.
        </li>
        <li>
          <strong>Enforcement:</strong> Repeated or bad-faith claims can result in account limits, suspension, or termination.
        </li>
      </ul>

      <h2>Refunds &amp; Billing</h2>
      <p>
        Temporary removal during an investigation does not entitle the account to a refund. See{" "}
        <a href="/terms">Terms of Service</a> for details on cancellations and refunds, and{" "}
        <a href="/privacy">Privacy Policy</a> for data handling during disputes.
      </p>

      <h2>Impersonation &amp; AUP</h2>
      <p>
        Impersonation and misrepresentation are prohibited. See our{" "}
        <a href="/aup">Acceptable Use Policy</a> for examples of prohibited conduct and potential enforcement actions.
      </p>

      <h2>Report a Dispute</h2>
      <p>
        Email <a href="mailto:abuse@aeobro.com">abuse@aeobro.com</a> with:
      </p>
      <ul>
        <li>URL(s) of the disputed page(s) on AEOBRO.</li>
        <li>Your claimed domain/handles and the verification method you can complete.</li>
        <li>A brief description of the issue and any supporting evidence.</li>
      </ul>

      <hr />

      <p className="text-sm text-gray-500">
        Note: AEOBRO is not a court of law. Our verification and enforcement processes aim to protect users and
        downstream consumers of structured data. We may update this policy as our service evolves.
      </p>
    </section>
  );
}
