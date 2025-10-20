// app/(marketing)/audit/page.tsx
import Script from "next/script";
import React from "react";

// Make this request/compute on every hit
export const dynamic = "force-dynamic" as const;

export const metadata = {
  title: "AI-Visibility Audit | AEOBRO",
  description:
    "Quick, provisional AI-visibility score for your brand or domain. Enter a site or brand name to see a rough baseline.",
  alternates: { canonical: "/audit" },
} as const;

type PageProps = {
  searchParams?: { [key: string]: string | string[] | undefined };
};

function normalizeToHttpUrl(input: string): string | null {
  let q = input.trim();
  if (!q) return null;
  // If it's a raw domain, add https://
  if (!/^https?:\/\//i.test(q)) {
    // If it has spaces, treat it like a brand (not a URL)
    if (/\s/.test(q)) return null;
    q = "https://" + q;
  }
  try {
    const u = new URL(q);
    return u.href;
  } catch {
    return null;
  }
}

async function fetchTextWithTimeout(url: string, timeoutMs = 3500): Promise<string | null> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, cache: "no-store", redirect: "follow" });
    if (!res.ok) return null;
    const text = await res.text();
    return text.slice(0, 1_500_000); // safety cap
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function checkHeadOk(url: string, timeoutMs = 2500): Promise<boolean> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: "HEAD", signal: controller.signal, cache: "no-store", redirect: "follow" });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

type Signals = {
  jsonLdPresent: boolean;
  schemaTypeHit: boolean;
  sameAsCount: number;
  openGraphPresent: boolean;
  robotsOk: boolean;
  sitemapOk: boolean;
  finalUrl?: string;
};

function analyzeHtml(html: string): Omit<Signals, "robotsOk" | "sitemapOk" | "finalUrl"> {
  const jsonLdPresent = /<script[^>]+type=["']application\/ld\+json["'][^>]*>/i.test(html);
  const schemaTypeHit = /"@type"\s*:\s*"(Organization|Person|LocalBusiness)"/i.test(html);
  // crude sameAs count
  let sameAsCount = 0;
  const sameAsMatch = html.match(/"sameAs"\s*:\s*\[(.*?)\]/is);
  if (sameAsMatch) {
    const arrStr = sameAsMatch[1] || "";
    sameAsCount = (arrStr.match(/https?:\/\//gi) || []).length;
  }
  const openGraphPresent = /<meta\s+property=["']og:/i.test(html);
  return { jsonLdPresent, schemaTypeHit, sameAsCount, openGraphPresent };
}

function scoreFromSignals(sig: Signals): { score: number; breakdown: Array<[string, number]> } {
  const breakdown: Array<[string, number]> = [];
  let score = 40; // baseline for a resolvable domain

  if (sig.jsonLdPresent) { score += 25; breakdown.push(["JSON-LD detected", 25]); }
  if (sig.schemaTypeHit) { score += 10; breakdown.push(['Schema @type (Org/Person/LocalBusiness)', 10]); }
  if (sig.sameAsCount >= 2) { score += 8; breakdown.push([`sameAs links (>=2)`, 8]); }
  else if (sig.sameAsCount === 1) { score += 4; breakdown.push([`sameAs link (1)`, 4]); }

  if (sig.openGraphPresent) { score += 5; breakdown.push(["Open Graph tags", 5]); }
  if (sig.robotsOk) { score += 6; breakdown.push(["robots.txt reachable", 6]); }
  if (sig.sitemapOk) { score += 6; breakdown.push(["sitemap.xml reachable", 6]); }

  // Clamp 0–100
  score = Math.max(0, Math.min(100, score));
  return { score, breakdown };
}

export default async function Page({ searchParams }: PageProps) {
  const rawQ = searchParams?.q;
  const q = Array.isArray(rawQ) ? rawQ[0]?.trim() ?? "" : rawQ?.trim() ?? "";

  let computed:
    | { mode: "none" }
    | { mode: "brand"; score: number }
    | { mode: "url"; url: string; signals: Signals; score: number; breakdown: Array<[string, number]> } = { mode: "none" };

  if (q) {
    const asUrl = normalizeToHttpUrl(q);
    if (!asUrl) {
      // Treat as brand text — simple baseline (and prompt to claim/verify)
      computed = { mode: "brand", score: 35 };
    } else {
      // Try to fetch HTML and quick endpoints
      const html = await fetchTextWithTimeout(asUrl);
      const base = new URL(asUrl);
      const robotsOk = await checkHeadOk(`${base.origin}/robots.txt`);
      const sitemapOk = await checkHeadOk(`${base.origin}/sitemap.xml`);

      let jsonLdPresent = false;
      let schemaTypeHit = false;
      let sameAsCount = 0;
      let openGraphPresent = false;

      if (html) {
        const a = analyzeHtml(html);
        jsonLdPresent = a.jsonLdPresent;
        schemaTypeHit = a.schemaTypeHit;
        sameAsCount = a.sameAsCount;
        openGraphPresent = a.openGraphPresent;
      }

      const signals: Signals = {
        jsonLdPresent,
        schemaTypeHit,
        sameAsCount,
        openGraphPresent,
        robotsOk,
        sitemapOk,
        finalUrl: asUrl,
      };

      const { score, breakdown } = scoreFromSignals(signals);
      computed = { mode: "url", url: asUrl, signals, score, breakdown };
    }
  }

  // JSON-LD for page
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "AI-Visibility Audit",
    url: "https://aeobro.com/audit",
    description: "Quick, provisional AI-visibility score for your brand or domain.",
    isPartOf: { "@type": "WebSite", name: "AEOBRO", url: "https://aeobro.com" },
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://aeobro.com/" },
      { "@type": "ListItem", position: 2, name: "AI-Visibility Audit", item: "https://aeobro.com/audit" },
    ],
  };

  return (
    <section className="container py-16">
      {/* JSON-LD */}
      <Script type="application/ld+json" strategy="afterInteractive">
        {JSON.stringify(jsonLd)}
      </Script>
      <Script type="application/ld+json" strategy="afterInteractive">
        {JSON.stringify(breadcrumbLd)}
      </Script>

      <h1 className="text-4xl font-extrabold">AI-Visibility Audit</h1>
      <p className="mt-3 text-gray-600">
        Enter a domain or brand name to get a quick, provisional score (demo).
      </p>

      {/* Server-rendered form */}
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
          aria-describedby="audit-help"
        />
        <button
          type="submit"
          className="px-5 py-2 rounded-lg bg-black text-white font-semibold hover:opacity-90"
        >
          Get score
        </button>
      </form>

      {/* Helper text when no query */}
      {(!q || computed.mode === "none") && (
        <p id="audit-help" className="text-sm text-gray-500 mt-2">
          Example result: “✅ JSON-LD detected. AI-readiness score: 82 / 100 (Verified domain)”
        </p>
      )}

      {/* Results */}
      <div className="mt-6 space-y-2" aria-live="polite">
        {computed.mode === "brand" && (
          <>
            <p className="text-lg">
              Provisional Score: <strong>{computed.score}/100</strong>
            </p>
            <p className="text-sm text-gray-500">
              Tip: Provide a full domain (e.g., <code>example.com</code>) for a richer analysis.
            </p>
          </>
        )}

        {computed.mode === "url" && (
          <>
            <p className="text-lg">
              Provisional Score for <span className="font-mono">{computed.url}</span>:{" "}
              <strong>{computed.score}/100</strong>
            </p>

            <ul className="text-sm text-gray-700 list-disc pl-5">
              <li>{computed.signals.jsonLdPresent ? "✅" : "❌"} JSON-LD detected</li>
              <li>{computed.signals.schemaTypeHit ? "✅" : "❌"} schema.org @type (Org/Person/LocalBusiness)</li>
              <li>
                {computed.signals.openGraphPresent ? "✅" : "❌"} Open Graph tags
              </li>
              <li>
                {computed.signals.robotsOk ? "✅" : "❌"} <code>/robots.txt</code> reachable
              </li>
              <li>
                {computed.signals.sitemapOk ? "✅" : "❌"} <code>/sitemap.xml</code> reachable
              </li>
              <li>
                {computed.signals.sameAsCount > 0 ? "✅" : "❌"}{" "}
                {computed.signals.sameAsCount} sameAs link{computed.signals.sameAsCount === 1 ? "" : "s"}
              </li>
            </ul>

            {/* Tiny breakdown for transparency */}
            {computed.breakdown.length > 0 && (
              <details className="mt-2 text-sm">
                <summary className="cursor-pointer">How this score was computed</summary>
                <ul className="list-disc pl-5 mt-1 text-gray-600">
                  {computed.breakdown.map(([label, pts]) => (
                    <li key={label}>
                      +{pts} — {label}
                    </li>
                  ))}
                </ul>
              </details>
            )}

            <p className="text-xs text-gray-500 mt-2">
              Demo-grade check. For a full audit, AEOBRO evaluates JSON-LD quality, verification,
              entity disambiguation, link graph health, and crawlability over time.
            </p>
          </>
        )}
      </div>

      <hr className="my-10" />

      <div className="prose">
        <h2>What this score means</h2>
        <p>
          This is a lightweight demo to illustrate how AEOBRO can assess machine-readable presence.
          For a full audit, we analyze structured data (JSON-LD), verification status, entity
          disambiguation, link graph health, and crawlability over time.
        </p>
        <p className="text-sm text-gray-500">
          Last updated:{" "}
          {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>
    </section>
  );
}
