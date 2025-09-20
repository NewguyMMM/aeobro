// app/(marketing)/audit/page.tsx
import React from "react";
import { headers } from "next/headers";

// ✅ Revalidate (ISR) — marketing page; adjust as desired
export const revalidate = 3600;

// ✅ SEO metadata
export const metadata = {
  title: "AI-Visibility Audit | AEOBRO",
  description:
    "Quick, provisional AI-visibility score for your brand or domain. Enter a site or brand name to see a rough baseline.",
  alternates: { canonical: "/audit" },
} as const;

export default async function Page() {
  // Read query (?q=...) server-side so we can render without client JS
  const hdrs = await headers();
  const url = hdrs.get("x-url") ?? ""; // may be undefined locally; we’ll fall back
  const search = url ? new URL(url).searchParams : new URLSearchParams();

  const q = search.get("q")?.trim() ?? "";
  // Match your old heuristic: looks like a domain/URL -> 55, otherwise 35
  const looksLikeDomain =
    q.startsWith("http://") ||
    q.startsWith("https://") ||
    q.includes("."); // crude but mirrors your previous behavior
  const score = q ? (looksLikeDomain ? 55 : 35) : undefined;

  // JSON-LD
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "AI-Visibility Audit",
    "url": "https://aeobro.com/audit",
    "description":
      "Quick, provisional AI-visibility score for your brand or domain.",
    "isPartOf": {
      "@type": "WebSite",
      "name": "AEOBRO",
      "url": "https://aeobro.com"
    }
  };
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://aeobro.com/" },
      { "@type": "ListItem", "position": 2, "name": "AI-Visibility Audit", "item": "https://aeobro.com/audit" }
    ]
  };

  return (
    <section className="container py-16">
      {/* JSON-LD */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />

      <h1 className="text-4xl font-extrabold">AI-Visibility Audit</h1>
      <p className="mt-3 text-gray-600">
        Enter a domain or brand name to get a quick, provisional score (demo).
      </p>

      {/* Server-rendered form (no client JS needed) */}
      <form className="mt-6 flex items-center gap-3" action="/audit" method="get">
        <label className="sr-only" htmlFor="q">Domain or brand</label>
        <input
          id="q"
          name="q"
          defaultValue={q}
          placeholder="example.com or Brand Inc."
          className="px-3 py-2 border rounded-lg w-full max-w-md"
          autoComplete="off"
          inputMode="url"
        />
        <button
          type="submit"
          className="px-5 py-2 rounded-lg bg-black text-white font-semibold hover:opacity-90"
        >
          Get score
        </button>
      </form>

      {score !== undefined && (
        <div className="mt-6">
          <p className="text-lg">
            Provisional Score: <strong>{score}/100</strong>
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Heuristic used: values that look like a domain/URL (e.g., contain a dot or start with http/https) score 55; plain names score 35.
          </p>
        </div>
      )}

      <hr className="my-10" />

      <div className="prose">
        <h2>What this score means</h2>
        <p>
          This is a lightweight demo to illustrate how AEOBRO can assess machine-readable presence.
          For a full audit, we analyze structured data (JSON-LD), verification status, entity
          disambiguation, link graph health, and crawlability over time.
        </p>
        <p className="text-sm text-gray-500">
          Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>
    </section>
  );
}
