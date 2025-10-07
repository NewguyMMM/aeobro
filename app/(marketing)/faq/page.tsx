// app/(marketing)/faq/page.tsx
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
            "AEOBRO is a machine-readable registry that helps AI systems find verified facts about your brand.",
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
        name: "How do I create a profile on AEOBRO?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Click the \"Create Your AI Ready Profile\" button on aeobro.com.",
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
            "Verification. Creators (Lite) verify with a social media account. Businesses (Pro+) verify with your business domain. Without verification, your profile can exist as a draft, but it won’t publish to AI engines.",
        },
      },
      {
        "@type": "Question",
        name: "What do I need to create an AEOBRO profile? (Long answer)",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "Every profile must connect to something you control—a social account (creators) or a domain (businesses). Creators verify via YouTube/Google/Instagram/TikTok/Meta. Businesses verify via DNS TXT record or domain email. Verified creators publish Person/Creator schema; verified businesses publish Organization schema including FAQs, services, and locations.",
        },
      },
      {
        "@type": "Question",
        name: "Why does AEOBRO require verification?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "To prevent impersonation, ensure AI engines see data from verified sources, and give your profile authority and visibility.",
        },
      },
      {
        "@type": "Question",
        name:
          "I’m a small business with no website and only a non-business email. Can I still sign up?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "Yes. Lite tier supports platform verification via OAuth (YouTube, TikTok, Instagram, Substack, Etsy) or code-in-bio. Pro requires domain + matching business email. Lite publishes Person/Creator schema; you can upgrade to Organization/LocalBusiness after adding a domain.",
        },
      },
      {
        "@type": "Question",
        name: "Why should I use AEOBRO instead of just publishing the same information on my own website?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "AEOBRO publishes structured, verified JSON-LD that AI engines prioritize. Regular pages may be inconsistently parsed. Verified profiles reduce impersonation and ensure AI systems pull the right facts.",
        },
      },
      {
        "@type": "Question",
        name: "What is JSON-LD?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "JSON-LD (JavaScript Object Notation for Linked Data) labels the facts on a page so Google, ChatGPT, and other AI systems can understand them with certainty.",
        },
      },
      {
        "@type": "Question",
        name: "How do I cancel?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "Use the “Cancel subscription” button in billing. Service continues until the end of your current billing period; renewals stop.",
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

      /* ------ NEW: Feature explanations (FAQPage JSON-LD) ------ */
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

      <div className="space-y-8">
        <div className="card">
          <h3 className="font-semibold">What is AEOBRO?</h3>
          <p className="text-gray-700 mt-2">
            AEOBRO is a machine-readable registry that helps AI systems find verified facts about
            your brand.
          </p>
        </div>

        <div className="card">
          <h3 className="font-semibold">What does AEOBRO stand for?</h3>
          <p className="text-gray-700 mt-2">
            AI Engine Optimization · Business Reach Optimization
          </p>
        </div>

        {/* ✅ Renamed question */}
        <div className="card">
          <h3 className="font-semibold">How do I create a profile on AEOBRO?</h3>
          <p className="text-gray-700 mt-2">
            Click the <strong>“Create Your AI Ready Profile”</strong> button on aeobro.com.
          </p>
        </div>

        {/* ✅ New Q&A just after the creation question */}
        <div className="card">
          <h3 className="font-semibold">What is an AI-ready Profile?</h3>
          <p className="text-gray-700 mt-2">
            Your information, organized as a public page plus structured data (JSON-LD) that helps
            search engines and AI assistants understand your information. It isn’t a chatbot and
            doesn’t act on your behalf.
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
              <strong>Creators (Lite):</strong> Verify with a social media account.
            </li>
            <li>
              <strong>Businesses (Pro+):</strong> Verify with your business domain.
            </li>
          </ul>
          <p className="text-gray-700 mt-2">
            Without verification, your profile can exist as a draft, but it won’t publish to AI
            engines.
          </p>
        </div>

        <div className="card">
          <h3 className="font-semibold">
            What do I need to create an AEOBRO profile? (Long answer)
          </h3>
          <p className="text-gray-700 mt-2">
            Every AEOBRO profile must connect to something you truly control — either a{" "}
            <strong>social account</strong> (for creators) or a <strong>domain</strong> (for
            businesses). This prevents impersonation and ensures AI search engines trust the
            information.
          </p>

          <h4 className="font-medium mt-4">For Creators (Lite)</h4>
          <p className="text-gray-700 mt-2">
            Verify by connecting one of your social accounts (YouTube, Google, Instagram, TikTok, or
            Meta).
          </p>
          <p className="text-gray-700 mt-2">
            Once verified, your profile publishes structured data that represents you as a{" "}
            <strong>Person/Creator</strong>, so AI engines can recognize your official handles.
          </p>

          <h4 className="font-medium mt-4">For Businesses (Pro and above)</h4>
          <p className="text-gray-700 mt-2">
            Verify ownership of your official website/domain by either:
          </p>
          <ul className="list-disc list-inside text-gray-700 mt-2 space-y-1">
            <li>
              Adding a simple <strong>DNS TXT record</strong> (preferred)
            </li>
            <li>
              Confirming with an email from your domain (e.g.,{" "}
              <code className="bg-gray-100 px-1 rounded">you@yourcompany.com</code>)
            </li>
          </ul>
          <p className="text-gray-700 mt-2">
            Once verified, your profile can publish structured data for your{" "}
            <strong>Organization</strong>, including FAQs, services, and locations — exactly what AI
            search engines expect from a business.
          </p>
        </div>

        <div className="card">
          <h3 className="font-semibold">Why does AEOBRO require verification?</h3>
          <ul className="list-disc list-inside text-gray-700 mt-2 space-y-1">
            <li>To protect brands and creators from impersonation.</li>
            <li>To ensure AI search engines only see information from verified sources.</li>
            <li>To give your profile real authority and visibility once it’s connected.</li>
          </ul>
        </div>

        <div className="card">
          <h3 className="font-semibold">
            I’m a small business with no website and only a non-business email (e.g.,
            businessname@gmail.com). Can I still sign up?
          </h3>
          <p className="text-gray-700 mt-2">Yes. AEOBRO offers two pathways:</p>

          <h4 className="font-medium mt-4">Pro Tier (Domain Verification)</h4>
          <p className="text-gray-700 mt-2">
            Requires a website domain + matching business email (e.g., hello@mybusiness.com).
          </p>

          <h4 className="font-medium mt-4">Lite Tier (Platform Verification)</h4>
          <p className="text-gray-700 mt-2">
            Built for small businesses, creators, and service providers without a website.
            Verification happens through your existing platform identity:
          </p>
          <ul className="list-disc list-inside text-gray-700 mt-2 space-y-1">
            <li>OAuth login with YouTube, TikTok, Instagram, Substack, or Etsy</li>
            <li>A simple “code-in-bio” method (we give you a short code/link to place in your bio)</li>
          </ul>
          <p className="text-gray-700 mt-2">
            Once verified, your AEOBRO profile publishes as a{" "}
            <strong>Person/Creator schema</strong>, trusted by AI systems.
          </p>
          <p className="text-gray-700 mt-2">
            If you later upgrade to Pro, you can export as{" "}
            <strong>Organization/LocalBusiness</strong> once you add a domain + business email.
          </p>
        </div>

        <div className="card">
          <h3 className="font-semibold">
            Why should I use AEOBRO instead of just publishing the same information on my own
            website?
          </h3>
          <p className="text-gray-700 mt-2">
            Because AI engines don’t just read websites — they prioritize{" "}
            <strong>structured, verified data</strong>. A regular webpage may or may not be
            interpreted correctly.
          </p>
          <ul className="list-disc list-inside text-gray-700 mt-2 space-y-1">
            <li>Your facts are formatted in machine-readable JSON-LD schema.org.</li>
            <li>Only verified profiles are published, giving your data higher trust.</li>
            <li>Your brand or creator identity cannot be impersonated.</li>
            <li>
              AI systems (search engines, chatbots, recommendation engines) pull the{" "}
              <em>right</em> information directly, rather than scraping inconsistently from the open
              web.
            </li>
          </ul>
          <p className="text-gray-700 mt-2">
            In short:{" "}
            <strong>
              AEOBRO makes AI engines see your profile as the official source of truth — something a
              normal website page alone cannot guarantee.
            </strong>
          </p>
        </div>

        {/* MOVED HERE: What is JSON-LD? */}
        <div className="card">
          <h3 className="font-semibold">What is JSON-LD?</h3>
          <p className="text-gray-700 mt-2">
            <strong>JSON-LD</strong> (JavaScript Object Notation for Linked Data) is a behind-the-scenes
            data format that labels the facts on a page so <strong>Google, ChatGPT, and other AI
            systems</strong> can understand them with certainty.
          </p>
          <p className="text-gray-700 mt-2">
            Think of it as a <strong>business card for machines</strong>: humans read your site, but AI
            needs clean, structured fields (name, links, category, address) to know who you are.
          </p>
          <p className="text-gray-700 mt-2">
            <strong>Why it matters:</strong> Structured, verified JSON-LD helps AI pull the{" "}
            <em>right</em> details about your brand—consistently and with higher trust.
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

        {/* NEW FAQ ITEMS */}
        <div className="card">
          <h3 className="font-semibold">How do I cancel?</h3>
          <p className="text-gray-700 mt-2">
            Click the <strong>Cancel subscription</strong> button in your billing settings. Canceling
            stops future renewals, and your service continues until the end of your current billing
            period.
          </p>
        </div>

        <div className="card">
          <h3 className="font-semibold">How does AEOBRO handle refunds?</h3>
          <p className="text-gray-700 mt-2">
            There are <strong>no refunds</strong>. If your profile is taken down or frozen during an
            investigation, no refunds will be issued. You may cancel at any time; cancellation stops
            renewals, and your service continues until the end of the current billing period.
          </p>
        </div>

        <div className="card">
          <h3 className="font-semibold">What happens to my profile if I cancel my subscription?</h3>
          <p className="text-gray-700 mt-2">
            After your subscription lapses, you will <strong>lose</strong> access to premium features
            and editing. Your public profile will no longer be published (and therefore won’t be
            crawlable by machines). We retain your profile data for <strong>90 days</strong> so you
            can reactivate. After 90 days with no reactivation, the profile may be permanently
            deleted per our retention policy.
          </p>
        </div>

        {/* --------- NEW: Feature explanations (UI section) ---------- */}
        <div className="card">
          <h3 className="font-semibold">What do the pricing features mean?</h3>

          <h4 className="font-medium mt-4">Centralized AI Ready Profile</h4>
          <p className="text-gray-700 mt-2">
            A single, verified public page plus structured JSON-LD that consolidates your official
            links and key facts. <em>Advantage:</em> simplifies discovery for AI systems by pointing
            them at one consistent source. (This improves clarity, not rankings; no placements are
            guaranteed.)
          </p>

          <h4 className="font-medium mt-4">Basic profile (links/images caps)</h4>
          <p className="text-gray-700 mt-2">
            Core fields (name, tagline, bio) with a limited number of links and images.
            <em> Advantage:</em> fast setup with clean machine-readable output and minimal upkeep.
          </p>

          <h4 className="font-medium mt-4">FAQ markup <span className="text-gray-500">(Coming soon)</span></h4>
          <p className="text-gray-700 mt-2">
            Publish common questions and answers in schema.org format. <em>Advantage:</em> helps AI
            assistants retrieve accurate responses to routine questions. (Not yet available.)
          </p>

          <h4 className="font-medium mt-4">Service markup <span className="text-gray-500">(Coming soon)</span></h4>
          <p className="text-gray-700 mt-2">
            Structured data describing offerings, service areas, and attributes. <em>Advantage:</em>
            clearer machine understanding of what you do. (Not yet available.)
          </p>

          <h4 className="font-medium mt-4">Change history <span className="text-gray-500">(Coming soon)</span></h4>
          <p className="text-gray-700 mt-2">
            A record of profile edits over time. <em>Advantage:</em> transparency and easier audits
            for systems that prefer up-to-date, traceable sources. (Not yet available.)
          </p>

          <h4 className="font-medium mt-4">Everything in Pro</h4>
          <p className="text-gray-700 mt-2">
            Business includes all Pro features plus scalability options below. <em>Advantage:</em>
            one tier to centralize multi-location/teams/automation needs. (Items labeled “Coming
            soon” are not active yet.)
          </p>

          <h4 className="font-medium mt-4">Multi-location (10) <span className="text-gray-500">(Coming soon)</span></h4>
          <p className="text-gray-700 mt-2">
            Manage structured data for up to 10 locations under one brand.
            <em> Advantage:</em> consistent data across all sites/areas. (Not yet available.)
          </p>

          <h4 className="font-medium mt-4">Team seats (3) <span className="text-gray-500">(Coming soon)</span></h4>
          <p className="text-gray-700 mt-2">
            Three user logins with role-appropriate access. <em>Advantage:</em> safer collaboration
            without shared passwords. (Not yet available.)
          </p>

          <h4 className="font-medium mt-4">Bulk import + webhooks <span className="text-gray-500">(Coming soon)</span></h4>
          <p className="text-gray-700 mt-2">
            Bring in data at scale and receive change notifications to your systems.
            <em> Advantage:</em> reduces manual work and keeps sources synchronized. (Not yet
            available.)
          </p>

          <h4 className="font-medium mt-4">Advanced analytics <span className="text-gray-500">(Coming soon)</span></h4>
          <p className="text-gray-700 mt-2">
            Reports on completeness and machine-readability signals. <em>Advantage:</em> helps you
            prioritize improvements. (Not yet available.)
          </p>
        </div>
      </div>
    </section>
  );
}
