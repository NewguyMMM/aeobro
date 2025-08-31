export default function Home() {
  return (
    <main className="container py-16">
      <h1 className="text-4xl font-bold mb-4">
        Make <span className="text-sky-500">AI</span> find you.
      </h1>
      <p className="text-gray-600 mb-8">
        AEOBRO turns your brand facts into machine-readable profiles with verification and JSON-LD.
      </p>
      <div className="flex gap-4">
        <a href="/dashboard" className="px-4 py-2 rounded-lg border hover:bg-gray-50">
          Create your profile
        </a>
        <a href="/pricing" className="px-4 py-2 rounded-lg border hover:bg-gray-50">
          See pricing
        </a>
      </div>
    </main>
  );
}

