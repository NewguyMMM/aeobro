// app/(marketing)/faq/page.tsx
import Script from "next/script";
import React from "react";

// ✅ Incremental Static Regeneration (rebuilds this page at most once per hour)
export const revalidate = 3600;

// ✅ Basic SEO metadata (Next.js App Router)
export const metadata = {
  title: "AEOBRO FAQ",
  description:
    "Answers about AEOBRO verification, tiers, publishing to AI engines, cancellations, and feature definitions.",
  alternates: { canonical: "/faq" },
} as const;

export default function Page() {
  // ✅ Structured data for rich results (FAQPage)
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "What is AEOBRO?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "AEOBRO is the creator of the AI Identity Layer™—a machine-readable registry that helps AI systems find verified facts about your brand, business, or creator identity. AEOBRO publishes a public, structured record (including JSON-LD) so modern AI systems can represent you accurately instead of guessing.",
        },
      },
      {
        "@type": "Question",
        name: "What does AEOBRO stand for?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "AI Engine Optimization · Business Reach Optimization.",
        },
      },
      {
        "@type": "Question",
        name: "Will AEOBRO guarantee rankings, traffic, or visibility?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "No. AEOBRO does not promise rankings, traffic, placement, or revenue. No rankings promised. No traffic guarantees. Just accurate representation. AI systems and search engines decide what to surface and when.",
        },
      },
      {
        "@type": "Question",
        name: "Why don’t I see results immediately?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "Because AI systems update on their own schedules. AEOBRO defines the record they reference, but it does not control when third-party systems refresh or display it.",
        },
      },
      // ⬇️ What is JSON-LD? follows the acronym explanation & disclaimers
      {
        "@type": "Question",
        name: "What is JSON-LD?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "JSON-LD (JavaScript Object Notation for Linked Data) is a structured data format that labels your information so AI systems and search engines can understand it—not just see it. It’s a digital language that connects your brand to the web of knowledge machines use—making your facts discoverable and trustworthy for AI and search technologies. Think of it as a business card for machines: humans read your site, but AI needs clean, structured fields (name, links, category, address) to know who you are. Why it matters: Structured, verified JSON-LD helps AI pull the right details about your brand—consistently and with higher trust.",
        },
      },
      {
        "@type": "Question",
        name: "How do I create a profile on AEOBRO?",
        acceptedAnswer: {
          "@type": "Answer",
          text: 'Click the "Create Your AI Ready Profile" button on aeobro.com.',
        },
      },
      {
        "@type": "Question",
        name: "What is an AI-ready Profile?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "Your information, organized as a public page plus structured data (JSON-LD) that helps search engines and AI assistants understand your information. It isn’t a chatbot and doesn’t act on your behalf.",
        },
      },
      {
        "@type": "Question",
        name: "What do I need to create an AEOBRO profile? (Short answer)",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "Verification. Creators (Lite): a web domain, or a social media account you control for verification. Businesses (Plus and Pro): a web business domain, or a social media account you control for verification (business domains are preferred). Without verification, your profile can exist as a draft, but it won’t publish to AI engines.",
        },
      },
      {
        "@type": "Question",
        name: "What do I need to create an AEOBRO profile? (Long answer)",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "Every AEOBRO profile must connect to something you truly control—typically a domain or a platform account. This prevents impersonation and increases trust for machine-readers. Creators can verify via supported platforms (OAuth or code-in-bio). Businesses can verify via DNS TXT record or domain email. Verified creators publish Person/Creator schema; verified businesses publish Organization/LocalBusiness schema including FAQs, services, and locations (where applicable).",
        },
      },
      {
        "@type": "Question",
        name: "Why does AEOBRO require verification?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "To prevent impersonation, ensure AI engines see data from controlled sources, and increase trust weight for your structured identity record.",
        },
      },
      {
        "@type": "Question",
        name:
          "I’m a small business with no website and only a non-business email. Can I still sign up?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "Yes. You can start with platform verification (Lite) using a social account you control (OAuth or code-in-bio). You can later add a domain and upgrade to publish Organization/LocalBusiness schema once you have a business domain.",
        },
      },
      {
        "@type": "Question",
        name:
          "Why should I use AEOBRO instead of just publishing the same information on my own website?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "Publishing accurate facts on a website is valuable for humans—but AI systems and search engines perform best with structured, verified JSON-LD. AEOBRO formats your data in machine-readable schema, uses verification to increase trust signals, and reduces impersonation risk by tying profiles to identities people actually control. AEOBRO helps AI systems pull correct information rather than guessing from inconsistent web sources.",
        },
      },
      {
        "@type": "Question",
        name:
          "Why can’t I just add JSON-LD to my current website, and skip AEOBRO?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "You can—and we encourage it. AEOBRO generates clean, standards-based JSON-LD you can paste into your website. We recommend updating your website’s JSON-LD whenever you update your AEOBRO profile. However, publishing JSON-LD only on your website means your identity exists in a single, self-asserted location. By also publishing on AEOBRO, your brand maintains a verifiable, trusted, and citable third-party identity layer that AI systems can reference independently of your website. AEOBRO does not guarantee rankings or placement; it improves accuracy, consistency, and trust signals for machine interpretation.",
        },
      },
      // ⬇️ Non-affiliation disclaimer Q&A
      {
        "@type": "Question",
        name: "Is AEOBRO affiliated with OpenAI, Google, or Perplexity?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "AEOBRO is an independent service and is not affiliated with OpenAI, Google, Anthropic, or Perplexity. References to platforms such as ChatGPT, Gemini, and similar AI systems are provided solely to illustrate how AEOBRO’s structured data can improve visibility across modern AI and search ecosystems. All trademarks belong to their respective owners.",
        },
      },
      {
        "@type": "Question",
        name: "How do I cancel?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            'Use the "Manage subscription" link in the site footer to open the secure Stripe Billing Portal. From there you can change plans (upgrade or downgrade), update your payment method, or cancel your subscription. Service continues until the end of your current billing period; renewals stop.',
        },
      },
      {
        "@type": "Question",
        name: "How does AEOBRO handle refunds?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "No refunds. If a profile is taken down or frozen during an investigation, refunds are not issued. You may cancel any time; service remains active until the period ends.",
        },
      },
      {
        "@type": "Question",
        name: "What happens to my profile if I cancel?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "After lapse, premium features and editing are disabled and the public profile is unpublished (no longer crawlable). Data is retained for 90 days for reactivation; after that, it may be deleted per policy.",
        },
      },

      /* ------ Feature explanations (FAQPage JSON-LD) ------ */
      {
        "@type": "Question",
        name: "What is a Centralized AI Ready Profile?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "A single public page that consolidates your official links, facts, and structured JSON-LD. Advantage: reduces confusion for AI systems by pointing them at one verified source of truth. No guarantee of ranking or inclusion.",
        },
      },
      {
        "@type": "Question",
        name: "What does Basic profile (links/images caps) include?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "Core fields (name, tagline, bio) plus a limited number of links and images. Advantage: a quick, lightweight setup that still produces valid structured data without heavy maintenance.",
        },
      },
      {
        "@type": "Question",
        name: "What is FAQ markup?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "A way to publish your common questions and answers in schema.org format. Advantage: helps AI assistants and search engines retrieve accurate responses to routine questions. Marked as Coming soon; not yet available.",
        },
      },
      {
        "@type": "Question",
        name: "What is Service markup?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "Structured data describing what you offer, service areas, and key attributes. Advantage: makes it easier for AI systems to understand your offerings. Coming soon; not yet available.",
        },
      },
      {
        "@type": "Question",
        name: "What is Change history?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "A log of edits to your profile (what changed and when). Advantage: transparency for audits and faster trust-building with AI systems that prefer up-to-date sources. Coming soon; not yet available.",
        },
      },
      {
        "@type": "Question",
        name: "What does Everything in Pro mean?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "Business includes all Pro features plus scalability options. Advantage: one tier for teams that need multi-location, seats, and automation. Features listed as Coming soon are not yet active.",
        },
      },
      {
        "@type": "Question",
        name: "What is Multi-location?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "Support for publishing structured data for multiple locations under one brand. Advantage: cleaner management and clearer signals for AI about where you operate. Coming soon; not yet available.",
        },
      },
      {
        "@type": "Question",
        name: "What are Team seats?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "Multiple user logins with role-appropriate access. Advantage: safer collaboration without sharing passwords. Coming soon; not yet available.",
        },
      },
      {
        "@type": "Question",
        name: "What are Bulk import and webhooks?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "Tools to bring in data at scale and receive change notifications. Advantage: reduces manual entry and keeps external systems in sync. Coming soon; not yet available.",
        },
      },
      {
        "@type": "Question",
        name: "What are Advanced analytics?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "Reporting about profile completeness and machine-readability signals (e.g., JSON-LD coverage). Advantage: helps prioritize improvements. Coming soon; not yet available.",
        },
      },
    ],
  };

  return (
    <section className="container py-16">
      {/* JSON-LD for FAQ rich results */}
      <Script type="application/ld+json" strategy="afterInteractive">
        {JSON.stringify(faqJsonLd)}
      </Script>

      <h1 className="text-4xl font-extrabold mb-10">
        <span>AEO</span>
        <span className="text-primary">BRO</span> FAQ
      </h1>

      {/* Optional but powerful: Micro-FAQ under hero */}
      <div className="card mb-8">
        <h3 className="font-semibold">Why don’t I see results immediately?</h3>
        <p className="text-gray-700 mt-2">
          Because AI systems update on their own schedules. AEOBRO defines the
          record they reference, but it doesn’t control when third-party systems
          refresh or display it.
        </p>
      </div>

      <div className="space-y-8">
        <div className="card">
          <h3 className="font-semibold">What is AEOBRO?</h3>
          <p className="text-gray-700 mt-2">
            AEOBRO is the creator of the <strong>AI Identity Layer™</strong>—a
            machine-readable registry that helps AI systems find verified facts
            about your brand, business, or creator identity.
          </p>
          <p className="text-gray-700 mt-2">
            AEOBRO publishes a public, structured record (including{" "}
            <strong>JSON-LD</strong>) so AI systems can represent you accurately
            instead of guessing.
          </p>
        </div>

        <div className="card">
          <h3 className="font-semibold">What does AEOBRO stand for?</h3>
          <p className="text-gray-700 mt-2">
            AI Engine Optimization · Business Reach Optimization
          </p>
        </div>

        <div className="card">
          <h3 className="font-semibold">
            Will AEOBRO guarantee rankings, traffic, or visibility?
          </h3>
          <p className="text-gray-700 mt-2">
            No. AEOBRO does not promise rankings, traffic, placement, or revenue.
          </p>
          <p className="text-gray-700 mt-2">
            <strong>No rankings promised. No traffic guarantees.</strong> Just
            accurate representation. AI systems and search engines decide what
            to surface and when.
          </p>
        </div>

        {/* JSON-LD card follows the acronym explanation */}
        <div className="card">
          <h3 className="font-semibold">What is JSON-LD?</h3>
          <p className="text-gray-700 mt-2">
            <strong>JSON-LD</strong> (JavaScript Object Notation for Linked
            Data) is a structured data format that labels your information so AI
            systems and search engines can understand it—not just see it.
          </p>
          <p className="text-gray-700 mt-2">
            It’s a digital language that connects your brand to the web of
            knowledge machines use—making your facts discoverable and trustworthy
            for AI and search technologies.
          </p>
          <p className="text-gray-700 mt-2">
            Think of it as a <strong>business card for machines</strong>: humans
            read your site, but AI needs clean, structured fields (name, links,
            category, address) to know who you are.
          </p>
          <p className="text-gray-700 mt-2">
            <strong>Why it matters:</strong> Structured, verified JSON-LD helps
            AI pull the <em>right</em> details about your brand—consistently and
            with higher trust.
          </p>
          <div className="mt-4">
            <pre className="bg-gray-50 p-4 rounded-xl overflow-auto text-sm">
              <code>
                {`{
  "@context": "https://schema.org",
  "@type": "CafeOrCoffeeShop",
  "name": "Joe's Coffee Shop",
  "address": {
    "streetAddress": "123 Main Street",
    "addressLocality": "Springfield",
    "addressRegion": "NJ"
  }
}`}
              </code>
            </pre>
          </div>
        </div>

        <div className="card">
          <h3 className="font-semibold">How do I create a profile on AEOBRO?</h3>
          <p className="text-gray-700 mt-2">
            Click the <strong>“Create Your AI Ready Profile”</strong> button on
            aeobro.com.
          </p>
        </div>

        <div className="card">
          <h3 className="font-semibold">What is an AI-ready Profile?</h3>
          <p className="text-gray-700 mt-2">
            Your information, organized as a public page plus structured data
            (JSON-LD) that helps search engines and AI assistants understand your
            information. It isn’t a chatbot and doesn’t act on your behalf.
          </p>
        </div>

        <div className="card">
          <h3 className="font-semibold">
            What do I need to create an AEOBRO profile? (Short answer)
          </h3>
          <p className="text-gray-700 mt-2">
            <strong>Verification.</strong>
          </p>
          <ul className="list-disc list-inside text-gray-700 mt-2 space-y-1">
            <li>
              <strong>Creators (Lite):</strong> A web domain, or a social media
              account you control for verification.
            </li>
            <li>
              <strong>Businesses (Plus and Pro):</strong> A web business domain,
              or a social media account you control for verification.{" "}
              <strong>Business domains are preferred.</strong>
            </li>
          </ul>
          <p className="text-gray-700 mt-2">
            Profiles without verification cannot publish to the AI ecosystem.
            Without verification, your profile can exist as a draft, but it
            won’t publish to AI engines.
          </p>
        </div>

        <div className="card">
          <h3 className="font-semibold">
            What do I need to create an AEOBRO profile? (Long answer)
          </h3>
          <p className="text-gray-700 mt-2">
            Every AEOBRO profile must connect to something you truly control—
            typically a <strong>domain</strong> or a{" "}
            <strong>platform account</strong>. This prevents impersonation and
            increases trust for machine-readers.
          </p>
          <p className="text-gray-700 mt-2">
            Creators can verify via supported platforms (OAuth or code-in-bio).
            Businesses can verify via DNS TXT record or domain email. Verified
            creators publish Person/Creator schema; verified businesses publish
            Organization/LocalBusiness schema including FAQs, services, and
            locations (where applicable).
          </p>
        </div>

        <div className="card">
          <h3 className="font-semibold">
            Why should I use AEOBRO instead of just publishing the same
            information on my own website?
          </h3>
          <p className="text-gray-700 mt-2">
            Publishing accurate facts on a website is valuable for humans—but AI
            systems and search engines perform best with{" "}
            <strong>structured, verified JSON-LD</strong>.
          </p>
          <ul className="list-disc list-inside text-gray-700 mt-2 space-y-1">
            <li>Your facts are formatted in machine-readable JSON-LD.</li>
            <li>Verification increases trust signals for AI systems.</li>
            <li>
              Reduces impersonation risk by tying profiles to identities people
              actually control.
            </li>
            <li>
              Helps AI systems pull the <em>right</em> information instead of
              guessing from inconsistent sources.
            </li>
          </ul>
          <p className="text-gray-700 mt-2">
            <em>Note:</em> AEOBRO improves accuracy and consistency for machines,
            but does not guarantee placement, ranking, traffic, or revenue.
          </p>
        </div>

        {/* NEW: Website JSON-LD vs AEOBRO */}
        <div className="card">
          <h3 className="font-semibold">
            Why can’t I just add JSON-LD to my current website, and skip AEOBRO?
          </h3>
          <p className="text-gray-700 mt-2">
            You can—and we encourage it.
          </p>
          <p className="text-gray-700 mt-2">
            AEOBRO generates clean, standards-based JSON-LD you can paste into
            your website. We recommend updating your website’s JSON-LD whenever
            you update your AEOBRO profile.
          </p>
          <p className="text-gray-700 mt-2">
            However, publishing JSON-LD only on your website means your identity
            exists in a single, self-asserted location. By also publishing on
            AEOBRO, your brand maintains a{" "}
            <strong>verifiable, trusted, and citable</strong> third-party identity
            layer that AI systems can reference independently of your website.
          </p>
          <p className="text-gray-700 mt-2">
            AEOBRO does not guarantee rankings or placement; it improves
            accuracy, consistency, and trust signals for machine interpretation.
          </p>
        </div>

        {/* Non-affiliation disclaimer card */}
        <div className="card">
          <h3 className="font-semibold">
            Is AEOBRO affiliated with OpenAI, Google, or Perplexity?
          </h3>
          <p className="text-gray-700 mt-2">
            AEOBRO is an independent service and is not affiliated with OpenAI,
            Google, Anthropic, or Perplexity. References to platforms such as
            ChatGPT, Gemini, and similar AI systems are provided solely to
            illustrate how AEOBRO’s structured data can improve visibility
            across modern AI and search ecosystems. All trademarks belong to
            their respective owners.
          </p>
        </div>

        <div className="card">
          <h3 className="font-semibold">How do I cancel?</h3>
          <p className="text-gray-700 mt-2">
            Use the <strong>Manage subscription</strong> link in the site footer
            to open the secure Stripe Billing Portal. From there you can change
            plans (upgrade or downgrade), update your payment method, or cancel
            your subscription. Your service continues until the end of your
            current billing period; renewals stop.
          </p>
        </div>

        <div className="card">
          <h3 className="font-semibold">How does AEOBRO handle refunds?</h3>
          <p className="text-gray-700 mt-2">
            There are <strong>no refunds</strong>. If your profile is taken down
            or frozen during an investigation, refunds will not be issued. You
            may cancel at any time; cancellation stops renewals, and your
            service continues until the end of the current billing period.
          </p>
        </div>

        <div className="card">
          <h3 className="font-semibold">
            What happens to my profile if I cancel my subscription?
          </h3>
          <p className="text-gray-700 mt-2">
            After your subscription lapses, premium features and editing are
            disabled and your public profile is unpublished (no longer
            crawlable). We retain your profile data for{" "}
            <strong>90 days</strong> so you can reactivate. After 90 days with no
            reactivation, the profile may be permanently deleted per our
            retention policy.
          </p>
        </div>

        {/* --------- Feature explanations (UI section) ---------- */}
        <div className="card">
          <h3 className="font-semibold">What do the pricing features mean?</h3>

          <h4 className="font-medium mt-4">Centralized AI Ready Profile</h4>
          <p className="text-gray-700 mt-2">
            A single, verified public page plus structured JSON-LD that
            consolidates your official links and key facts. <em>Advantage:</em>{" "}
            simplifies discovery for AI systems by pointing them at one
            consistent source. (No guarantees of placement or ranking.)
          </p>

          <h4 className="font-medium mt-4">
            Basic profile (links/images caps)
          </h4>
          <p className="text-gray-700 mt-2">
            Core fields (name, tagline, bio) with a limited number of links and
            images. <em>Advantage:</em> fast setup with clean machine-readable
            output and minimal upkeep.
          </p>

          <h4 className="font-medium mt-4">
            FAQ markup <span className="text-gray-500">(Coming soon)</span>
          </h4>
          <p className="text-gray-700 mt-2">
            Publish common questions and answers in schema.org format.{" "}
            <em>Advantage:</em> helps AI assistants retrieve accurate responses
            to routine questions.
          </p>

          <h4 className="font-medium mt-4">
            Service markup <span className="text-gray-500">(Coming soon)</span>
          </h4>
          <p className="text-gray-700 mt-2">
            Structured data describing offerings, service areas, and attributes.{" "}
            <em>Advantage:</em> clearer machine understanding of what you do.
          </p>

          <h4 className="font-medium mt-4">
            Change history <span className="text-gray-500">(Coming soon)</span>
          </h4>
          <p className="text-gray-700 mt-2">
            A record of profile edits over time. <em>Advantage:</em> transparency
            and easier audits for systems that prefer up-to-date, traceable
            sources.
          </p>

          <h4 className="font-medium mt-4">Everything in Pro</h4>
          <p className="text-gray-700 mt-2">
            Business includes all Pro features plus scalability options below.{" "}
            <em>Advantage:</em> one tier to centralize multi-location/teams/
            automation needs. (Items labeled “Coming soon” are not active yet.)
          </p>

          <h4 className="font-medium mt-4">
            Multi-location (10) <span className="text-gray-500">(Coming soon)</span>
          </h4>
          <p className="text-gray-700 mt-2">
            Manage structured data for up to 10 locations under one brand.{" "}
            <em>Advantage:</em> consistent data across all sites/areas.
          </p>

          <h4 className="font-medium mt-4">
            Team seats (3) <span className="text-gray-500">(Coming soon)</span>
          </h4>
          <p className="text-gray-700 mt-2">
            Three user logins with role-appropriate access. <em>Advantage:</em>{" "}
            safer collaboration without shared passwords.
          </p>

          <h4 className="font-medium mt-4">
            Bulk import + webhooks <span className="text-gray-500">(Coming soon)</span>
          </h4>
          <p className="text-gray-700 mt-2">
            Bring in data at scale and receive change notifications to your
            systems. <em>Advantage:</em> reduces manual work and keeps sources
            synchronized.
          </p>

          <h4 className="font-medium mt-4">
            Advanced analytics <span className="text-gray-500">(Coming soon)</span>
          </h4>
          <p className="text-gray-700 mt-2">
            Reports on completeness and machine-readability signals.{" "}
            <em>Advantage:</em> helps you prioritize improvements.
          </p>
        </div>
      </div>
    </section>
  );
}
