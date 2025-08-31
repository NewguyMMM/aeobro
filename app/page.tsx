export default function Home() {
  return (
    <main className="container py-16">
      <h1 className="text-4xl font-bold mb-4">
        Make <span className="text-sky-500">AI</span> find you.
      </h1>

      {/* Split tagline into two lines */}
      <p className="text-gray-600 max-w-2xl">
        AEOBRO turns your brand facts into centralized machine-readable profiles.
      </p>
      <p className="text-gray-600 mb-4 max-w-2xl">
        Structured, efficient, trusted, and always up-to-date.
      </p>

      {/* Secondary credibility booster */}
      <p className="text-gray-500 mb-8 max-w-2xl">
        Verified JSON-LD profiles that machines can trust.
      </p>

      <div className="flex gap-4">
        {/* Primary CTA — bigger & bolder */}
        <a
          href="/dashboard"
          className="px-6 py-4 rounded-xl bg-black text-white font-semibold text-lg hover:bg-gray-900"
        >
          Create your AI Profile
        </a>

        {/* Secondary CTA */}
        <a
          href="/pricing"
          className="px-6 py-4 rounded-xl border font-medium text-lg hover:bg-gray-50"
        >
          See pricing
        </a>
      </div>
    </main>
  );
}
