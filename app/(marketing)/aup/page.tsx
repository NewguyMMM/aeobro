// app/(marketing)/aup/page.tsx
import React from "react";

// ✅ ISR (kept at 1 hour)
export const revalidate = 3600;

// ✅ SEO metadata
export const metadata = {
  title: "Acceptable Use Policy | AEOBRO",
  description:
    "AEOBRO Acceptable Use Policy. Learn what’s allowed and prohibited, including spam, fraud, impersonation, hate, illegal content, and security violations.",
  alternates: { canonical: "/aup" },
} as const;

export default function AupPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "Acceptable Use Policy",
    "url": "https://aeobro.com/aup",
    "description":
      "Acceptable Use Policy for AEOBRO, outlining prohibited activities and enforcement actions.",
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
      { "@type": "ListItem", "position": 2, "name": "Acceptable Use Policy", "item": "https://aeobro.com/aup" }
    ]
  };

  return (
    <section className="container py-16 prose max-w-3xl">
      {/* ✅ JSON-LD */}
      <Script type="application/ld+json" strategy="afterInteractive">
  {JSON.stringify(jsonLd)}
</Script>
      <Script type="application/ld+json" strategy="afterInteractive">
  {JSON.stringify(breadcrumbLd)}
</Script>

      <h1 className="text-4xl font-extrabold mb-2">Acceptable Use Policy</h1>
      <p className="text-gray-600 mb-8">
        Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
      </p>

      <p>
        To keep AEOBRO safe and reliable, you agree not to misuse the Service. The following are
        examples of prohibited conduct. Violations may result in content removal, account
        suspension, or termination without refund, consistent with our Terms of Service.
      </p>

      <h2>Prohibited Content & Activities</h2>
      <ul>
        <li><strong>Illegal activity:</strong> Content or conduct that violates any applicable law or regulation.</li>
        <li><strong>Fraud & deception:</strong> Phishing, scams, impersonation, or misrepresenting identity, affiliation, or verification status.</li>
        <li><strong>IP infringement:</strong> Unauthorized use of copyrighted works, trademarks, or trade secrets; selling counterfeit goods.</li>
        <li><strong>Hate, harassment, and violence:</strong> Content that promotes or threatens violence; targets protected classes with hate or harassment.</li>
        <li><strong>Exploitation & abuse:</strong> Sexual exploitation, child endangerment, or content that risks physical or emotional harm.</li>
        <li><strong>Security violations:</strong> Attempting to access accounts, data, or systems without authorization; probing, scanning, or testing the vulnerability of any system.</li>
        <li><strong>Spam & platform abuse:</strong> Bulk or manipulative behavior, link farms, deceptive redirects, or attempts to manipulate search/AI rankings.</li>
        <li><strong>Malware & interference:</strong> Distributing malicious code or taking actions that disrupt or degrade the Service.</li>
        <li><strong>Personal data misuse:</strong> Collecting, publishing, or selling personal data without lawful basis and consent.</li>
        <li><strong>High-risk or regulated goods:</strong> Listings or promotion that violate local laws or our policy (e.g., weapons, illegal substances).</li>
      </ul>

      <h2>Verification & Publishing</h2>
      <p>
        Publishing structured data requires verification (platform OAuth or domain proof).
        Misuse of verification workflows (e.g., fraudulent proofs, code-in-bio manipulation)
        is prohibited and may result in removal of published data and account action.
      </p>

      <h2>Enforcement</h2>
      <p>
        We may remove content, limit features, suspend, or terminate accounts for policy violations
        or risk to users. We may preserve and disclose information when required by law or to
        protect users and the Service.
      </p>

      <h2>Reporting</h2>
      <p>
        To report abuse, contact <a href="mailto:abuse@aeobro.com">abuse@aeobro.com</a>. Include links,
        a description of the issue, and any relevant evidence so we can investigate quickly.
      </p>
    </section>
  );
}
