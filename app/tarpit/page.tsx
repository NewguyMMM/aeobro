// app/tarpit/page.tsx
// Updated: 2025-10-29 10:36 ET
// Simple benign 200 page used by anti-enumeration middleware.

export const dynamic = "force-static";
export const revalidate = 0;

export default function TarpitPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-xl font-semibold">AEOBRO</h1>
      <p className="mt-3 text-sm text-gray-600">
        Thanks for visiting. If you were looking for a specific profile, please
        try again later.
      </p>
    </main>
  );
}
