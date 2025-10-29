// app/(app)/dashboard/error.tsx
"use client";
import React from "react";

export default function DashboardError({ error }: { error: Error & { digest?: string } }) {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-xl font-semibold text-red-600">Dashboard failed to load</h1>
      {error?.digest ? <p className="mt-2 text-sm">Digest: {error.digest}</p> : null}
      <pre className="mt-4 whitespace-pre-wrap rounded-md bg-neutral-50 p-3 text-xs text-neutral-800">
        {error?.message || String(error)}
      </pre>
      <p className="mt-3 text-sm text-neutral-600">
        Tip: Check Vercel → Logs for the full stack trace (Serverless Function logs).
      </p>
    </main>
  );
}
