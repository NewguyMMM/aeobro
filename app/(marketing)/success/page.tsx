export const metadata = {
  title: 'Success — AEOBRO',
};

export default function SuccessPage() {
  return (
    <main className="container py-20">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-4xl font-extrabold tracking-tight">✅ Payment successful</h1>
        <p className="text-gray-600 mt-4">
          Thanks for subscribing to AEOBRO. Your plan is active.
        </p>

        <div className="mt-8 flex items-center justify-center gap-3">
          <a
            href="/dashboard"
            className="px-5 py-3 rounded-lg bg-black text-white font-semibold hover:opacity-90"
          >
            Go to Dashboard
          </a>
          <a
            href="/pricing"
            className="px-5 py-3 rounded-lg border font-semibold hover:bg-gray-50"
          >
            Back to Pricing
          </a>
        </div>

        <p className="text-xs text-gray-500 mt-6">
          If you don’t see your subscription right away, give it a few seconds or refresh.
        </p>
      </div>
    </main>
  );
}

