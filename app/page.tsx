// app/page.tsx
export default function Home() {
  return (
    <main className="container pt-24 md:pt-28 pb-20">
      <h1 className="text-5xl font-extrabold tracking-tight mb-4">
        Help <span className="text-sky-500">AI</span> find you.
      </h1>

      {/* Tagline */}
      <p className="text-gray-700 max-w-2xl">
        AEOBRO optimizes your content to be picked up and displayed by AI.
      </p>
      <p className="text-gray-700 mb-4 max-w-2xl">
        Structured, efficient, trusted, and kept current in one place.
      </p>

      {/* Secondary credibility booster */}
      <p className="text-gray-500 mb-8 max-w-2xl">
        Verified JSON-LD profiles that machines can trust.
      </p>

      <div className="flex gap-3">
        {/* Primary CTA — black with blue hover */}
        <a
          href="/dashboard"
          className="inline-flex h-12 items-center justify-center rounded-xl bg-black px-5 font-medium text-white hover:bg-sky-600 transition-colors"
          aria-label="Create Your AI Ready Profile"
        >
          Create Your AI Ready Profile
        </a>

        {/* Secondary CTA */}
        <a
          href="/pricing"
          className="inline-flex h-12 items-center justify-center rounded-xl border px-5 font-medium hover:border-sky-600 hover:text-sky-700 transition-colors"
        >
          See pricing
        </a>
      </div>
    </main>
  );
}
