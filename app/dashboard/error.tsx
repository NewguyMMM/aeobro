// app/dashboard/error.tsx
"use client";

export default function DashboardError({ error }: { error: Error & { digest?: string } }) {
  console.error("[dashboard error]", error);
  return (
    <div className="container py-12">
      <h1 className="text-2xl font-semibold mb-4">Something went wrong</h1>
      <p className="text-gray-600 mb-6">
        We couldn’t load your dashboard. Try refreshing the page. If the issue persists, sign out
        and back in. {error?.digest ? `Error code: ${error.digest}` : ""}
      </p>
      <div className="flex gap-3">
        <button className="px-4 py-2 rounded-lg border" onClick={() => window.location.reload()}>
          Refresh
        </button>
        <a className="px-4 py-2 rounded-lg border" href="/login">
          Go to sign in
        </a>
      </div>
    </div>
  );
}
