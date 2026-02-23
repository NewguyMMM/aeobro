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
            "AEOBRO is the creator of the AI Identity Layer™—a machine-readable, public, verified identity registry that AI systems can reference as verified facts about your brand, business, or creator identity. AEOBRO provides: a canonical public record (one stable published URL representing the authoritative version of your organization), verification-gated claims (facts are published only when ownership or authority can be proven), and machine-readable structure (your identity, services, and FAQs are published in formats AI systems can interpret and cite). In review: a reference-grade truth source using a structured record (including JSON-LD) so AI systems can represent you accurately instead of guessing. AEOBRO is not an AI assistant. It does not answer questions, chat with users, generate AI responses, or promise rankings, traffic, or visibility boosts. AI assistants interpret information; AEOBRO publishes the official version of that information.",
        },
      },
      {
        "@type": "Question",
        name: "Why did we create AEOBRO?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "The problem is that AI systems already answer questions about your organization. They pull from outdated websites, scraped directories, inconsistent bios, and unverified third-party claims. When facts conflict, AI systems infer. Inference is not authority. AEOBRO was created to ease the costly pain point of inference with a clear public record.",
        },
      },
      {
        "@type": "Question",
        name: "How is AEOBRO different from an AI assistant?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "AI assistants vs AEOBRO: AI assistants generate answers, interpret sources, change behavior as models update, and do not maintain official records. AEOBRO publishes official records, verifies authority, persists across model updates, and can be cited as a source. AEOBRO does not compete with AI assistants; it gives them something defensible to reference.",
        },
      },
      {
        "@type": "Question",
        name: "Who is AEOBRO for?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "AEOBRO is for organizations where accuracy matters: professional services, regulated industries, reputation-sensitive businesses, and entities frequently misrepresented online.",
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
      {
        "@type": "Question",
        name: "Why don’t I see results immediately?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "Because AI systems update on their own schedules. AEOBRO defines the record they reference, but it doesn’t control when third-party systems refresh or display it.",
        },
      },
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
        name: "Will AEOBRO guarantee rankings, traffic, or visibility?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "No. AEOBRO does not promise rankings, traffic, placement, or revenue. No rankings promised. No traffic guarantees. Just accurate representation. AI systems and search engines decide what to surface and when.",
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
        name: "What do the pricing features mean?",
        acceptedAnswer: {
          "@type": "Answer",
          text:
            "Centralized AI Ready Profile: a single, verified public page plus structured JSON-LD that consolidates your official links and key facts. Basic profile: core fields (name, tagline, bio) with a limited number of links and images. Products / Catalog: structured listings of products or offerings in a machine-readable format. Updates: a publishable stream of official changes (new offerings, announcements, corrections) that keeps your record current. FAQ markup: publish common questions and answers in schema.org format. Service markup: structured data describing offerings, service areas, and attributes.",
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
            AEOBRO is the creator of the <strong>AI Identity Layer™</strong>—a
            machine-readable, public, verified identity registry that helps AI
            systems find verified facts about your brand, business, or creator
            identity.
          </p>

          <p className="text-gray-700 mt-3">
            <strong>AEOBRO provides:</strong>
          </p>
          <ul className="list-disc list-inside text-gray-700 mt-2 space-y-2">
            <li>
              <strong>A canonical public record</strong>
              <br />
              One stable published URL that represents the authoritative version
              of your organization.
            </li>
            <li>
              <strong>Verification-gated claims</strong>
              <br />
              Facts are published only when ownership or authority can be proven.
            </li>
            <li>
              <strong>Machine-readable structure</strong>
              <br />
              Your identity, services, and FAQs are published in formats AI
              systems can interpret and cite.
            </li>
          </ul>

          <p className="text-gray-700 mt-4">
            In review, a reference-grade truth source using a structured record
            (including <strong>JSON-LD</strong>) so AI systems can represent you
            accurately instead of guessing.
          </p>

          <div className="mt-4">
            <p className="text-gray-700">
              <strong>AEOBRO is not an AI assistant.</strong>
            </p>
            <p className="text-gray-700 mt-2">It does not:</p>
            <ul className="list-disc list-inside text-gray-700 mt-2 space-y-1">
              <li>answer questions</li>
              <li>chat with users</li>
              <li>generate AI responses</li>
              <li>promise rankings, traffic, or visibility boosts</li>
            </ul>
            <p className="text-gray-700 mt-3">
              AI assistants interpret information. AEOBRO publishes the official
              version of that information.
            </p>
          </div>
        </div>

        {/* NEW: Why AEOBRO exists */}
        <div className="card">
          <h3 className="font-semibold">Why did we create AEOBRO?</h3>
          <p className="text-gray-700 mt-2">
            The problem is that AI systems already answer questions about your
            organization.
          </p>
          <p className="text-gray-700 mt-2">They pull from:</p>
          <ul className="list-disc list-inside text-gray-700 mt-2 space-y-1">
            <li>outdated websites</li>
            <li>scraped directories</li>
            <li>inconsistent bios</li>
            <li>unverified third-party claims</li>
          </ul>
          <p className="text-gray-700 mt-3">
            When facts conflict, AI systems infer.
          </p>
          <p className="text-gray-700 mt-2">
            <strong>Inference is not authority.</strong>
            <br />
            AEOBRO was created to ease the costly pain point of inference, with a
            clear public record.
          </p>
        </div>

        {/* NEW: AI assistants vs AEOBRO */}
        <div className="card">
          <h3 className="font-semibold">
            How is AEOBRO different from an AI assistant?
          </h3>

          <p className="text-gray-700 mt-2">
            <strong>AI assistants vs AEOBRO</strong>
          </p>

          <div className="grid md:grid-cols-2 gap-6 mt-3">
            <div>
              <p className="text-gray-900 font-medium">AI assistants</p>
              <ul className="list-disc list-inside text-gray-700 mt-2 space-y-1">
                <li>Generate answers</li>
                <li>Interpret sources</li>
                <li>Change behavior as models update</li>
                <li>Do not maintain official records</li>
              </ul>
            </div>
            <div>
              <p className="text-gray-900 font-medium">AEOBRO</p>
              <ul className="list-disc list-inside text-gray-700 mt-2 space-y-1">
                <li>Publishes official records</li>
                <li>Verifies authority</li>
                <li>Persists across model updates</li>
                <li>Can be cited as a source</li>
              </ul>
            </div>
          </div>

          <p className="text-gray-700 mt-4">
            AEOBRO does not compete with AI assistants.
            <br />
            It gives them something defensible to reference.
          </p>
        </div>

        {/* NEW: Who AEOBRO is for */}
        <div className="card">
          <h3 className="font-semibold">Who is AEOBRO for?</h3>
          <p className="text-gray-700 mt-2">
            AEOBRO is for organizations where accuracy matters:
          </p>
          <ul className="list-disc list-inside text-gray-700 mt-2 space-y-1">
            <li>professional services</li>
            <li>regulated industries</li>
            <li>reputation-sensitive businesses</li>
            <li>entities frequently misrepresented online</li>
          </ul>
        </div>

        <div className="card">
          <h3 className="font-semibold">What does AEOBRO stand for?</h3>
          <p className="text-gray-700 mt-2">
            AI Engine Optimization · Business Reach Optimization
          </p>
        </div>

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

        <div className="card">
          <h3 className="font-semibold">
            Why can’t I just add JSON-LD to my current website, and skip AEOBRO?
          </h3>
          <p className="text-gray-700 mt-2">You can—and we encourage it.</p>
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

        {/* Keep this just above affiliation tile */}
        <div className="card">
          <h3 className="font-semibold">Why don’t I see results immediately?</h3>
          <p className="text-gray-700 mt-2">
            Because AI systems update on their own schedules. AEOBRO defines the
            record they reference, but it doesn’t control when third-party systems
            refresh or display it.
          </p>
        </div>

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

        {/* Keep this just below affiliation tile */}
        <div className="card">
          <h3 className="font-semibold">
            Will AEOBRO guarantee rankings, traffic, or visibility?
          </h3>
          <p className="text-gray-700 mt-2">
            No. AEOBRO does not promise rankings, traffic, placement, or revenue.
          </p>
          <p className="text-gray-700 mt-2">
            <strong>No rankings promised. No traffic guarantees.</strong> Just
            accurate representation. AI systems and search engines decide what to
            surface and when.
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

          <h4 className="font-medium mt-4">Basic profile (links/images caps)</h4>
          <p className="text-gray-700 mt-2">
            Core fields (name, tagline, bio) with a limited number of links and
            images. <em>Advantage:</em> fast setup with clean machine-readable
            output and minimal upkeep.
          </p>

          <h4 className="font-medium mt-4">Products / Catalog</h4>
          <p className="text-gray-700 mt-2">
            Structured listings of products or offerings in a machine-readable
            format. <em>Advantage:</em> helps AI systems understand what you sell
            or offer, using consistent product data.
          </p>

          <h4 className="font-medium mt-4">Updates</h4>
          <p className="text-gray-700 mt-2">
            A publishable stream of official changes—new offerings, announcements,
            corrections, and clarifications. <em>Advantage:</em> keeps your record
            current and reduces stale or conflicting third-party descriptions.
          </p>

          <h4 className="font-medium mt-4">FAQ markup</h4>
          <p className="text-gray-700 mt-2">
            Publish common questions and answers in schema.org format.{" "}
            <em>Advantage:</em> helps AI assistants retrieve accurate responses
            to routine questions.
          </p>

          <h4 className="font-medium mt-4">Service markup</h4>
          <p className="text-gray-700 mt-2">
            Structured data describing offerings, service areas, and attributes.{" "}
            <em>Advantage:</em> clearer machine understanding of what you do.
          </p>
        </div>
      </div>
    </section>
  );
}
