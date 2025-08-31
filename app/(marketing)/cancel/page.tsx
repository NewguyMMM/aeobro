export const metadata = {
  title: 'Checkout canceled — AEOBRO',
};

export default function CancelPage() {
  return (
    <main className="container py-20">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-4xl font-extrabold tracking-tight">Checkout canceled</h1>
        <p className="text-gray-600 mt-4">
          No worries — your card wasn’t charged. You can try again anytime.
        </p>

        <div className="mt-8 flex items-center justify-center gap-3">
          <a
            href="/pricing"
            className="px-5 py-3 rounded-lg bg-black text-white font-semibold hover:opacity-90"
          >
            Return to Pricing
          </a>
          <a
            href="/"
            className="px-5 py-3 rounded-lg border font-semibold hover:bg-gray-50"
          >
            Go to Home
          </a>
        </div>
      </div>
    </main>
  );
}

