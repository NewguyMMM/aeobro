// app/api/profile/health/route.ts
import { NextRequest, NextResponse } from "next/server";

/**
 * Minimal HTML parsers (regex on purpose—no DOM libs).
 */
const CANONICAL_RE =
  /<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*>/i;
const JSONLD_RE =
  /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i;

export async function GET(req: NextRequest) {
  // Accept ?slug=… or ?id=…
  const { searchParams, origin } = new URL(req.url);
  const slug = searchParams.get("slug")?.trim() || "";
  const id = searchParams.get("id")?.trim() || "";

  if (!slug && !id) {
    return NextResponse.json(
      { ok: false, error: "Missing slug or id." },
      { status: 400 }
    );
  }

  // Build the expected public URL
  const path = `/p/${slug || id}`;
  const expected = new URL(path, origin).toString();

  try {
    // Hit the public page (GET so we can read the HTML)
    const res = await fetch(expected, {
      cache: "no-store",
      redirect: "follow",
      // timeout-ish: abort in ~8s if your runtime supports it (optional)
    });

    const finalUrl = res.url || expected;
    const status = res.status;

    let html = "";
    let canonicalHref: string | null = null;
    let jsonLdOk = false;

    if (res.ok && res.headers.get("content-type")?.includes("text/html")) {
      html = await res.text();

      // canonical
      const c = html.match(CANONICAL_RE);
      canonicalHref = c?.[1] ?? null;

      // Any JSON-LD present and parseable counts as OK.
      // (If you want to be stricter, validate @type and URL equality.)
      const j = html.match(JSONLD_RE);
      if (j?.[1]) {
        try {
          const data = JSON.parse(j[1].trim());
          jsonLdOk = !!data && (Array.isArray(data) ? data.length > 0 : true);
        } catch {
          jsonLdOk = false;
        }
      }
    }

    // Canonical check rules:
    // - Must exist
    // - Must point to the same path (/p/<slug-or-id>)
    // - Optional: host check (set NEXT_PUBLIC_CANONICAL_HOST to enforce)
    const expectedURL = new URL(expected);
    const canonicalURL = canonicalHref ? new URL(canonicalHref, origin) : null;

    const HOST_ENFORCE = process.env.NEXT_PUBLIC_CANONICAL_HOST?.trim();
    const samePath = canonicalURL?.pathname === expectedURL.pathname;
    const sameHost = HOST_ENFORCE
      ? canonicalURL?.host === HOST_ENFORCE
      : !!canonicalURL; // if no strict host, only require it to exist

    const canonicalOk = !!canonicalURL && samePath && sameHost;

    const ok = res.ok && canonicalOk && jsonLdOk;

    return NextResponse.json({
      ok,
      status,
      url: finalUrl,
      redirected: res.redirected,
      canonical: canonicalHref,
      canonicalOk,
      jsonLdOk,
      expected,
      issues: {
        http: res.ok ? null : `HTTP ${status}`,
        canonical:
          canonicalOk || !canonicalHref
            ? null
            : `Canonical mismatch (got ${canonicalHref}, expected path ${expectedURL.pathname}${
                HOST_ENFORCE ? ` and host ${HOST_ENFORCE}` : ""
              })`,
        jsonLd: jsonLdOk ? null : "Missing or invalid JSON-LD",
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: err?.message || "Fetch failed",
        expected,
      },
      { status: 500 }
    );
  }
}
