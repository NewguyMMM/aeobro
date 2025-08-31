export default function Home() {
  return (
    <main className="container py-16">
      <h1 className="text-4xl font-bold mb-4">
        Make <span className="text-sky-500">AI</span> find you.
      </h1>
      <p className="text-gray-600 mb-8 max-w-2xl">
        AEOBRO turns your brand facts into machine-readable profiles with
        verification and JSON-LD. Structured, trusted, and always up-to-date.
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
