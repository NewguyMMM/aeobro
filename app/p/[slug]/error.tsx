'use client';

export default function Error({ error }: { error: Error & { digest?: string } }) {
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-semibold mb-2">We hit a snag loading this profile.</h1>
      <p className="text-gray-600">
        Please refresh in a moment. If this keeps happening, contact support and include this code:
      </p>
      <pre className="mt-4 rounded bg-gray-100 p-3 text-sm">{error?.digest ?? 'no-digest'}</pre>
    </main>
  );
}
