// app/(marketing)/audit/page.tsx
import Script from "next/script";
import React from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic" as const;

export const metadata = {
  title: "AI-Visibility Audit | AEOBRO",
  description:
    "Quick, provisional AI-visibility score for your domain. Enter your domain address to see a rough baseline of your current AI interpretation.",
  alternates: { canonical: "/audit" },
} as const;

type PageProps = {
  searchParams?: { [key: string]: string | string[] | undefined };
};

// ---------- Utilities ----------
function normalizeToHttpUrl(input: string): string | null {
  let q = input.trim();
  if (!q) return null;
  if (!/^https?:\/\//i.test(q)) {
    if (/\s/.test(q)) return null; // looks like a brand, not a URL
    q = "https://" + q;
  }
  try {
    return new URL(q).href;
  } catch {
    return null;
  }
}

async function fetchTextWithTimeout(
  url: string,
  timeoutMs = 3500
): Promise<{ text: string | null; headers: Headers | null }> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
      redirect: "follow",
    });
    if (!res.ok) return { text: null, headers: res.headers };
    const text = await res.text();
    return { text: text.slice(0, 1_500_000), headers: res.headers };
  } catch {
    return { text: null, headers: null };
  } finally {
    clearTimeout(t);
  }
}

async function headOk(url: string, timeoutMs = 2500): Promise<boolean> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      cache: "no-store",
      redirect: "follow",
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

// ---------- Parsing helpers ----------
function extractMeta(
  content: string,
  name: string,
  attr: "name" | "property" = "property"
): string | null {
  const re = new RegExp(
    `<meta\\s+[^>]*${attr}=["']${name}["'][^>]*content=["']([^"']+)["'][^>]*>`,
    "i"
  );
  const m = content.match(re);
  return m ? m[1] : null;
}

function extractLink(content: string, rel: string): string | null {
  const re = new RegExp(
    `<link\\s+[^>]*rel=["']${rel}["'][^>]*href=["']([^"']+)["'][^>]*>`,
    "i"
  );
  const m = content.match(re);
  return m ? m[1] : null;
}

function arrify<T>(x: T | T[] | undefined | null): T[] {
  if (!x) return [];
  return Array.isArray(x) ? x : [x];
}

function uniqueDomains(urls: string[]): string[] {
  const set = new Set<string>();
  for (const u of urls) {
    try {
      const d = new URL(u).hostname.replace(/^www\./, "");
      set.add(d);
    } catch {}
  }
  return [...set];
}

function textScoreReadability(desc: string | null): {
  ok: boolean;
  len: number;
  jargonHits: number;
} {
  if (!desc) return { ok: false, len: 0, jargonHits: 0 };
  const len = desc.trim().length;
  const jargon =
    /\b(synergy|innovative|cutting-edge|holistic|leverage|ecosystem)\b/gi;
  const hits = (desc.match(jargon) || []).length;
  const ok = len >= 40 && len <= 160 && hits === 0;
  return { ok, len, jargonHits: hits };
}

// ---------- Parse HTML ----------
type Parsed = {
  html: string;
  title: string;
  ogSiteName: string | null;
  canonicalHref: string | null;
  hasTwitterCard: boolean;
  jsonLdBlocks: any[];
  hasOG: boolean;
};

function parseHtml(html: string, _headers: Headers | null): Parsed {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : "";

  const ogSiteName = extractMeta(html, "og:site_name");
  const hasOG = /<meta\s+property=["']og:/i.test(html);
  const canonicalHref = extractLink(html, "canonical");
  const hasTwitterCard = !!extractMeta(html, "twitter:card", "name");

  // Extract all JSON-LD blocks
  const jsonLdBlocks: any[] = [];
  const scriptRe =
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = scriptRe.exec(html))) {
    try {
      const raw = m[1].trim();
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) jsonLdBlocks.push(...parsed);
      else jsonLdBlocks.push(parsed);
    } catch {
      // ignore invalid JSON-LD
    }
  }

  return {
    html,
    title,
    ogSiteName,
    canonicalHref,
    hasTwitterCard,
    jsonLdBlocks,
    hasOG,
  };
}

// ---------- Scoring helpers ----------
function getAllTypes(blocks: any[]): string[] {
  const types: string[] = [];
  for (const b of blocks) {
    const t = arrify(b["@type"]).map((x: any) =>
      typeof x === "string" ? x : ""
    );
    types.push(...t);
  }
  return types.filter(Boolean);
}

function pickFirstDesc(blocks: any[]): string | null {
  for (const b of blocks) {
    if (typeof b?.description === "string" && b.description.trim())
      return b.description.trim();
  }
  return null;
}

function anyHas(objArr: any[], key: string): boolean {
  return objArr.some((b) => b && Object.prototype.hasOwnProperty.call(b, key));
}

function getPublisherUrl(blocks: any[]): string | null {
  for (const b of blocks) {
    const pub = b?.publisher;
    if (!pub) continue;
    if (typeof pub === "string") {
      try {
        return new URL(pub).origin;
      } catch {
        continue;
      }
    } else if (typeof pub === "object") {
      const url = pub.url || pub["@id"];
      if (typeof url === "string") {
        try {
          return new URL(url).origin;
        } catch {
          continue;
        }
      }
    }
  }
  return null;
}

function getSameAs(blocks: any[]): string[] {
  const out: string[] = [];
  for (const b of blocks) {
    const arr = arrify(b?.sameAs);
    for (const u of arr) if (typeof u === "string") out.push(u);
  }
  return out;
}

function getAddress(blocks: any[]): any | null {
  for (const b of blocks) {
    if (b?.address && typeof b.address === "object") return b.address;
  }
  return null;
}

function hasContact(blocks: any[]): boolean {
  for (const b of blocks) {
    if (typeof b?.telephone === "string" || typeof b?.email === "string")
      return true;
  }
  return false;
}

function hasLogoOrImage(blocks: any[]): boolean {
  for (const b of blocks) {
    if (
      typeof b?.logo === "string" ||
      typeof b?.image === "string" ||
      typeof b?.logo?.url === "string" ||
      typeof b?.image?.url === "string"
    )
      return true;
  }
  return false;
}

function hasServices(blocks: any[]): boolean {
  const types = getAllTypes(blocks).map((s) => s.toLowerCase());
  return (
    types.includes("service") ||
    types.includes("product") ||
    types.includes("offer")
  );
}

function hasFAQ(blocks: any[]): boolean {
  const types = getAllTypes(blocks).map((s) => s.toLowerCase());
  return types.includes("faqpage");
}

function hasSpeakable(blocks: any[]): boolean {
  return anyHas(blocks, "speakable");
}

function nameMatches(title: string, blocks: any[]): boolean {
  const names: string[] = [];
  for (const b of blocks) {
    if (typeof b?.name === "string") names.push(b.name.toLowerCase());
  }
  const t = title.toLowerCase().trim();
  return names.some((n) => n && t.includes(n));
}

// ---------- Scoring (18 actionable parameters = 100 points) ----------
type Check = {
  key: string;
  label: string;
  points: number;
  passed: boolean;
  note?: string;
};

const TOOLTIP: Record<string, string> = {
  jsonld:
    "Checks if the page exposes machine-readable structured data via JSON-LD.",
  type:
    "Verifies the entity is correctly typed (Organization, LocalBusiness, or Person).",
  og: "Detects Open Graph tags used for rich previews and social/AI snippets.",
  robots: "Confirms a robots.txt exists to guide crawlers.",
  sitemap: "Confirms a sitemap.xml exists so crawlers can discover pages.",
  sameas:
    "Counts authoritative profile links (Google, Facebook, LinkedIn, etc.) that prove identity.",
  address:
    "Looks for a PostalAddress with city/region to anchor local presence.",
  contact:
    "Checks for a telephone or email so AI systems can surface contact details.",
  logo: "Confirms a brand logo or primary image is defined.",
  publisher:
    "Compares the JSON-LD publisher to the site’s domain to confirm authorship.",
  services:
    "Finds Service/Product/Offer schema so AIs can understand what you do.",
  faq: "Detects FAQPage schema to power Q&A-style summaries.",
  graphdepth:
    "Rewards broader identity graph (3+ unique domains in sameAs links).",
  identity:
    "Checks that brand name and site signals align (title/OG vs JSON-LD).",
  readability:
    "Prefers a concise, clear description (40–160 chars, low jargon).",
  speakable:
    "Looks for speakable sections used by voice assistants.",
  canonical:
    "Checks for a canonical link to prevent duplicate-URL confusion.",
  twitter:
    "Detects Twitter Card tags for richer share cards and AI use.",
};

function scoreAll(
  baseOrigin: string,
  p: Parsed
): { checks: Check[]; total: number } {
  const types = getAllTypes(p.jsonLdBlocks);
  const typesLower = types.map((s) => s.toLowerCase());
  const sameAsList = getSameAs(p.jsonLdBlocks);
  const sameAsDomains = uniqueDomains(sameAsList);
  const address = getAddress(p.jsonLdBlocks);
  const hasAddress =
    !!address && (!!address.addressLocality || !!address.addressRegion);
  const contactOK = hasContact(p.jsonLdBlocks);
  const logoOK = hasLogoOrImage(p.jsonLdBlocks);
  const publisherOrigin = getPublisherUrl(p.jsonLdBlocks);
  const publisherOK =
    !!publisherOrigin &&
    publisherOrigin.replace(/^www\./, "") ===
      baseOrigin.replace(/^www\./, "");
  const servicesOK = hasServices(p.jsonLdBlocks);
  const faqOK = hasFAQ(p.jsonLdBlocks);
  const speakableOK = hasSpeakable(p.jsonLdBlocks);
  const canonicalOK = !!p.canonicalHref;
  const twitterOK = p.hasTwitterCard;
  const idConsistencyOK =
    nameMatches(p.title, p.jsonLdBlocks) &&
    (!!p.ogSiteName
      ? p.title.includes(p.ogSiteName) || p.ogSiteName.includes(p.title)
      : true);
  const desc = pickFirstDesc(p.jsonLdBlocks);
  const readability = textScoreReadability(desc);

  // Weights sum to 100
  const checks: Check[] = [
    {
      key: "jsonld",
      label: "JSON-LD detected",
      points: 14,
      passed: p.jsonLdBlocks.length > 0,
    },
    {
      key: "type",
      label: "Valid schema @type (Org/LocalBusiness/Person)",
      points: 9,
      passed: typesLower.some((t) =>
        ["organization", "localbusiness", "person"].includes(t)
      ),
    },
    {
      key: "og",
      label: "Open Graph tags present",
      points: 4,
      passed: p.hasOG,
    },
    {
      key: "robots",
      label: "robots.txt reachable",
      points: 4,
      passed: true,
    }, // patched after HEAD
    {
      key: "sitemap",
      label: "sitemap.xml reachable",
      points: 4,
      passed: true,
    }, // patched after HEAD
    {
      key: "sameas",
      label: "sameAs links (>=1)",
      points: 9,
      passed: sameAsList.length >= 1,
      note: `${sameAsList.length}`,
    },
    {
      key: "address",
      label: "Address completeness (locality/region)",
      points: 7,
      passed: hasAddress,
    },
    {
      key: "contact",
      label: "Contact info (phone or email)",
      points: 7,
      passed: contactOK,
    },
    {
      key: "logo",
      label: "Logo or image present",
      points: 3,
      passed: logoOK,
    },
    {
      key: "publisher",
      label: "Publisher/ownership consistency",
      points: 7,
      passed: publisherOK,
    },
    {
      key: "services",
      label: "Service/Product/Offer schema",
      points: 8,
      passed: servicesOK,
    },
    {
      key: "faq",
      label: "FAQ schema present",
      points: 4,
      passed: faqOK,
    },
    {
      key: "graphdepth",
      label: "sameAs graph depth (≥3 unique domains)",
      points: 5,
      passed: sameAsDomains.length >= 3,
      note: `${sameAsDomains.length}`,
    },
    {
      key: "identity",
      label: "Entity identity consistency (JSON-LD vs title/OG)",
      points: 4,
      passed: idConsistencyOK,
    },
    {
      key: "readability",
      label: "AI-readable description (40–160 chars, low jargon)",
      points: 4,
      passed: readability.ok,
      note: `len=${readability.len}`,
    },
    {
      key: "speakable",
      label: "Speakable (voice search) present",
      points: 2,
      passed: speakableOK,
    },
    {
      key: "canonical",
      label: "Canonical tag present",
      points: 3,
      passed: canonicalOK,
    },
    {
      key: "twitter",
      label: "Twitter Card tags present",
      points: 2,
      passed: twitterOK,
    },
  ];

  const total = checks.reduce((sum, c) => sum + (c.passed ? c.points : 0), 0);
  return { checks, total };
}

// ---------- Page ----------
export default async function Page({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);
  const isLoggedIn = !!session?.user;

  const rawQ = searchParams?.q;
  const q = Array.isArray(rawQ) ? rawQ[0]?.trim() ?? "" : rawQ?.trim() ?? "";

  let view:
    | { mode: "none" }
    | { mode: "brand"; score: number }
    | {
        mode: "url";
        url: string;
        robotsOk: boolean;
        sitemapOk: boolean;
        parsed: Parsed;
        checks: Check[];
        score: number;
        payloadJson: string; // for export button
      } = { mode: "none" };

  if (q) {
    const asUrl = normalizeToHttpUrl(q);
    if (!asUrl) {
      view = { mode: "brand", score: 35 };
    } else {
      const base = new URL(asUrl);
      const [htmlRes, robotsOk, sitemapOk] = await Promise.all([
        fetchTextWithTimeout(asUrl, 3500),
        headOk(`${base.origin}/robots.txt`, 2500),
        headOk(`${base.origin}/sitemap.xml`, 2500),
      ]);

      const parsed = htmlRes.text
        ? parseHtml(htmlRes.text, htmlRes.headers)
        : parseHtml("", htmlRes.headers);
      let { checks } = scoreAll(base.hostname.replace(/^www\./, ""), parsed);

      // Patch robots/sitemap from HEAD results
      checks = checks.map((c) =>
        c.key === "robots"
          ? { ...c, passed: robotsOk }
          : c.key === "sitemap"
          ? { ...c, passed: sitemapOk }
          : c
      );

      const clamped = Math.min(
        100,
        checks.reduce((s, c) => s + (c.passed ? c.points : 0), 0)
      );

      const payload = {
        url: asUrl,
        score: clamped,
        checks: checks.map(({ key, label, points, passed, note }) => ({
          key,
          label,
          points,
          passed,
          note: note ?? null,
          tooltip: TOOLTIP[key] ?? "",
        })),
        generatedAt: new Date().toISOString(),
      };

      view = {
        mode: "url",
        url: asUrl,
        robotsOk,
        sitemapOk,
        parsed,
        checks,
        score: clamped,
        payloadJson: JSON.stringify(payload, null, 2),
      };
    }
  }

  // Page JSON-LD
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "AI-Visibility Audit",
    url: "https://aeobro.com/audit",
    description:
      "Quick, provisional AI-visibility score for your domain. Enter your domain address to see a rough baseline of your current AI interpretation.",
    isPartOf: { "@type": "WebSite", name: "AEOBRO", url: "https://aeobro.com" },
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: "https://aeobro.com/",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "AI-Visibility Audit",
        item: "https://aeobro.com/audit",
      },
    ],
  } as const;

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
      <p
        className="mt-3 text-gray-600"
        title="A fast, single-page analysis with short timeouts."
      >
        Enter your domain address to get a quick snapshot analysis of how clearly
        AI systems can interpret your brand.
      </p>

      {/* Form */}
      <form className="mt-6 flex items-center gap-3" action="/audit" method="get">
        <label className="sr-only" htmlFor="q">
          Domain address
        </label>
        <input
          id="q"
          name="q"
          defaultValue={q}
          placeholder="example.com"
          className="px-3 py-2 border rounded-lg w-full max-w-md"
          autoComplete="off"
          inputMode="url"
          aria-describedby="audit-help-links audit-help"
        />
        <button
          type="submit"
          className="px-5 py-2 rounded-lg bg-black text-white font-semibold hover:opacity-90"
        >
          Get score
        </button>
      </form>

      {/* Helper text */}
      <p id="audit-help-links" className="mt-1 text-xs text-gray-500">
        You can enter any website URL.
      </p>

      {!q && (
        <p id="audit-help" className="text-sm text-gray-500 mt-2">
          Example result: “✅ JSON-LD detected. AI-readiness score: 82 / 100 (clear identity signals detected)”
        </p>
      )}

      {/* Results */}
      <div className="mt-6" aria-live="polite">
        {view.mode === "brand" && (
          <>
            <p className="text-lg">
              Provisional Score: <strong>{view.score}/100</strong>
            </p>
            <p className="text-sm text-gray-500">
              Tip: Provide a full domain (e.g., <code>example.com</code>) for a richer analysis.
            </p>
          </>
        )}

        {view.mode === "url" && (
          <>
            <div className="flex items-center gap-3">
              <p className="text-lg">
                AI-Readiness for <span className="font-mono">{view.url}</span>:{" "}
                <strong>{view.score}/100</strong>
              </p>

              {/* Export JSON button */}
              <button
                id="export-json"
                type="button"
                className="px-3 py-1.5 rounded-md border text-sm hover:bg-gray-50"
              >
                Export JSON
              </button>
            </div>

            {/* Hidden JSON payload for export */}
            <script
              id="audit-json"
              type="application/json"
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{ __html: view.payloadJson ?? "{}" }}
            />

            <ul className="text-sm text-gray-800 list-disc pl-5 mt-3 space-y-1">
              {view.checks.map((c) => (
                <li
                  key={c.key}
                  title={TOOLTIP[c.key] ?? ""}
                  className="cursor-help"
                >
                  {c.passed ? "✅" : "❌"} {c.label}
                  {typeof c.note !== "undefined" ? ` (${c.note})` : ""}
                </li>
              ))}
            </ul>

            <p className="text-xs text-gray-500 mt-3">
              Checks run server-side with short timeouts. For verified results and JSON-LD export, create an AEOBRO profile.
            </p>
          </>
        )}
      </div>

      {/* CTA: Create/Edit AI-Ready Profile */}
      {(view.mode === "url" || view.mode === "brand") && (
        <div className="mt-8">
          <h3 className="text-lg font-semibold mb-1">
            Boost your score with an AI-Ready Profile.
          </h3>
          <p className="text-sm text-gray-500 max-w-xl mb-4">
            Your AEOBRO profile stores verified, AI-ready data about your brand or organization
            so AI systems can discover, trust, and represent you more accurately.
          </p>

          <a
            href={isLoggedIn ? "/dashboard" : "/login"}
            className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition"
          >
            {isLoggedIn ? "Edit your AI-Ready Profile" : "Create your AI-Ready Profile"}
          </a>
        </div>
      )}

      <hr className="my-10" />

      <div className="prose">
        <h2>What this score means</h2>
        <p>
          This is an analysis of various parameters such as structured data (JSON-LD),
          verification status, entity disambiguation, link graph health, and crawlability over time.
          A higher score indicates clearer, more complete identity signals that help AI systems understand and interpret your brand.
        </p>

        {/* Clarification (expectations) */}
        <p className="text-sm text-gray-600">
          This score reflects signals declared on the page evaluated. Linking to an AEOBRO profile improves AI understanding,
          but on-site structured references (e.g., <code>sameAs</code>) are required for this audit to reflect that improvement.
        </p>

        {/* Proprietary disclaimer */}
        <p className="mt-2 text-xs text-gray-500">
          <strong>Disclaimer:</strong> The AEOBRO AI Visibility Score is a proprietary analysis
          based on 18 parameters measuring how clearly AI systems can interpret and understand your public web identity data.
          It is intended for informational and demonstration purposes only.
        </p>
        <p className="text-sm text-gray-500">
          Last updated:{" "}
          {new Date().toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      {/* Tiny client-side helper for Export JSON */}
      <Script id="audit-export-json" strategy="afterInteractive">
        {`
          (function () {
            const btn = document.getElementById('export-json');
            if (!btn) return;
            btn.addEventListener('click', function () {
              const node = document.getElementById('audit-json');
              if (!node) return;
              try {
                const jsonText = node.textContent || node.innerText || '';
                const blob = new Blob([jsonText], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'ai-visibility-audit.json';
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
              } catch (e) {
                console.error('Export failed', e);
                alert('Sorry, export failed. Please try again.');
              }
            });
          })();
        `}
      </Script>
    </section>
  );
}
