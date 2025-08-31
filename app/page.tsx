export default function Home() {
  return (
    <main className="container py-16">
      <h1 className="text-4xl font-bold mb-4">
        Make <span className="text-sky-500">AI</span> find you.
      </h1>

      {/* Main tagline */}
      <p className="text-gray-600 mb-4 max-w-2xl">
        AEOBRO turns your brand facts into centralized machine-readable profiles. 
        Structured, efficient, trusted, and always up-to-date.
      </p>

      {/* Secondary credibility booster */}
      <p className="text-gray-500 mb-8 max-w-2xl">
        Verified JSON-LD profiles that machines can trust.
      </p>

      <div className="flex gap-4">
        <a
          href="/dashboard"
          className="px-5 py-3 rounded-xl bg-black text-white hover:bg-gray-900"
        >
          Create your AI Profile
        </a>
        <a
          href="/pricing"
          className="px-5 py-3 rounded-xl border hover:bg-gray-50"
        >
          See pricing
        </a>
      </div>
    </main>
  );
}
