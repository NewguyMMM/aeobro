// app/(marketing)/faq/page.tsx
export default function Page() {
  return (
    <section className="container py-16">
      <h1 className="text-4xl font-extrabold mb-10">FAQ</h1>

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

        <div className="card">
          <h3 className="font-semibold">How do I create an AEOBRO profile?</h3>
          <p className="text-gray-700 mt-2">
            Click the <strong>“Create my AI Profile”</strong> button on aeobro.com.
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
          <p className="text-gray-700 mt-2">Verify ownership of your official website/domain by either:</p>
          <ul className="list-disc list-inside text-gray-700 mt-2 space-y-1">
            <li>Adding a simple <strong>DNS TXT record</strong> (preferred)</li>
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
            <li>Your facts are formatted in machine-readable JSON-L
