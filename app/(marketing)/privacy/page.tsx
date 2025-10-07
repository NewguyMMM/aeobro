// app/(marketing)/privacy/page.tsx
import Script from "next/script";
import React from "react";

// ✅ Revalidate once/day (adjust if you update more/less often)
export const revalidate = 86400;

// ✅ SEO metadata
export const metadata = {
  title: "Privacy Policy | AEOBRO",
  description:
    "How AEOBRO collects, uses, and protects your data. Learn about analytics, authentication, payments, and your rights under GDPR/CCPA.",
  alternates: { canonical: "/privacy" },
} as const;

export default function PrivacyPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "Privacy Policy",
    "url": "https://aeobro.com/privacy",
    "description":
      "Privacy Policy for AEOBRO covering data collection, usage, retention, security, and user rights (GDPR/CCPA).",
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
      { "@type": "ListItem", "position": 2, "name": "Privacy Policy", "item": "https://aeobro.com/privacy" }
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

      <h1 className="text-4xl font-extrabold">Privacy Policy</h1>
      <p className="mt-2 text-gray-600">Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>

      <p className="mt-6">
        We collect the minimum data needed to operate AEOBRO and to provide verification, billing,
        and account features. This policy describes what we collect, why, how long we keep it,
        and your rights under applicable laws (GDPR/CCPA).
      </p>

      <h2>Information We Collect</h2>
      <ul>
        <li><strong>Account & Authentication:</strong> Email address and sign-in events (via NextAuth). If you use magic links, we process emails to deliver sign-in links.</li>
        <li><strong>Profile Content:</strong> The facts you publish in your profile (e.g., name, handles, links, business details) and verification artifacts (e.g., DNS TXT proof or platform code-in-bio).</li>
        <li><strong>Billing:</strong> Subscription status, plan, and payment identifiers processed by Stripe (we do not store full card data).</li>
        <li><strong>Operational Communications:</strong> Service emails (e.g., receipts, verification notices) sent via Resend.</li>
        <li><strong>Technical Data:</strong> Basic logs and request metadata for security and abuse prevention.</li>
      </ul>

      <h2>How We Use Data</h2>
      <ul>
        <li>Provide and secure authentication and sessions.</li>
        <li>Verify profiles (platform OAuth or domain-based proofs) and publish structured data.</li>
        <li>Process subscriptions and payments through Stripe.</li>
        <li>Send essential service emails (verification, receipts, alerts).</li>
        <li>Prevent fraud and enforce our Terms and Acceptable Use Policy.</li>
      </ul>

      <h2>Service Providers</h2>
      <ul>
        <li><strong>Authentication:</strong> NextAuth (email and optional OAuth providers you connect).</li>
        <li><strong>Email Delivery:</strong> Resend (transactional emails).</li>
        <li><strong>Payments:</strong> Stripe (subscriptions and invoices).</li>
        <li><strong>Hosting:</strong> Vercel (app hosting and build logs).</li>
      </ul>

      <h2>Cookies & Similar Technologies</h2>
      <p>
        We use strictly necessary cookies for sign-in sessions and account security. If analytics are enabled
        in the future, we will update this page to describe those technologies and provide controls.
      </p>

      <h2>Data Retention</h2>
      <ul>
        <li><strong>Profile & Account Data:</strong> Retained while your account is active. If you cancel, profile publishing stops; we retain core data for up to <strong>90 days</strong> for reactivation, then delete or archive per policy.</li>
        <li><strong>Billing Records:</strong> Retained as required for tax and accounting compliance.</li>
        <li><strong>Security Logs:</strong> Retained for a limited time necessary to detect, investigate, and prevent abuse.</li>
      </ul>

      <h2>Your Rights</h2>
      <p>
        Depending on your location, you may have the right to access, correct, export, object to processing,
        or request deletion of your personal data. To exercise these rights, contact us at{" "}
        <a href="mailto:privacy@aeobro.com">privacy@aeobro.com</a> (or your preferred address).
      </p>

      <h2>Children’s Privacy</h2>
      <p>AEOBRO is not directed to children. Do not use the service if you are under the age required by law in your jurisdiction.</p>

      <h2>International Transfers</h2>
      <p>
        We may process data in the United States and other countries. Where required, we use appropriate safeguards for cross-border transfers.
      </p>

      <h2>Security</h2>
      <p>
        We implement technical and organizational measures to protect data. No method of transmission or storage is 100% secure; we continuously improve our safeguards.
      </p>

      <h2>Changes to This Policy</h2>
      <p>
        We may update this policy from time to time. Material changes will be posted here with a new “Last updated” date.
      </p>

      <h2>Contact</h2>
      <p>
        Questions or requests? Email <a href="mailto:privacy@aeobro.com">privacy@aeobro.com</a>.
      </p>
    </section>
  );
}
