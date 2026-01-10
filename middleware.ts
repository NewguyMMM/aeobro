// middleware.ts
// Updated: 2026-01-10 06:41 ET
// - Fix: Next.js client JS hydration + event handlers by relaxing CSP script-src (TEMPORARY)
// - Keep: Canonical host enforcement (aeobro.com + aeobro.vercel.app -> www.aeobro.com)
// - Keep: legacy auth redirects, Link header on /p/[slug], anti-enumeration
// - Keep: security headers (CSP, HSTS, X-CTO, Referrer-Policy, Permissions-Policy, etc.)
// - Keep: Edge-safe dynamic import() for Upstash libs

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// ---------- Canonical Host Enforcement ----------
const CANONICAL_HOST = "www.aeobro.com";
// Only enforce for these exact hosts (so preview deployments are not affected)
const ENFORCED_HOSTS = new Set(["aeobro.com", "aeobro.vercel.app"]);

// ---------- Tunables ----------
const PROBE_LIMIT_PER_MIN =
  parseInt(process.env.AEO_PROBE_LIMIT_PER_MIN || "", 10) || 30;
const TARPIT_PATH = "/tarpit";
const ENABLE_ANTI_ENUM = (process.env.AEO_ANTI_ENUM ?? "1") !== "0";

// If you self-host assets from other domains, add them here
const IMG_SRC = ["'self'", "data:", "https:"].join(" ");
const FONT_SRC = ["'self'", "data:"].join(" ");
const CONNECT_SRC = ["'self'", "https:", "wss:"].join(" ");

// Next.js App Router requires either nonce/hashes or (temporarily) allowing inline/eval.
// This is a STABILITY PATCH. Once stable, we can migrate to a nonce-based CSP.
function buildCSP(origin: string) {
  // Upgrade insecure requests only on HTTPS
  const upgrade = origin.startsWith("https://")
    ? "upgrade-insecure-requests; "
    : "";

  return [
    upgrade,
    "default-src 'self';",
    "base-uri 'none';",
    "object-src 'none';",

    // ✅ TEMPORARY: allow Next.js hydration + event handlers
    // Without this, Safari will show "Refused to execute a script..." and buttons become inert.
    "script-src 'self' 'unsafe-inline' 'unsafe-eval';",

    // Styles: allow inline for Tailwind/style tags emitted by Next.js
    "style-src 'self' 'unsafe-inline';",

    `img-src ${IMG_SRC};`,
    `font-src ${FONT_SRC};`,
    `connect-src ${CONNECT_SRC};`,

    // Disallow all framing
    "frame-ancestors 'none';",

    // Optional but useful:
    "form-action 'self';",
  ].join(" ");
}

// Extra security headers (defense-in-depth)
function applySecurityHeaders(req: NextRequest, res: NextResponse) {
  const { origin, hostname } = req.nextUrl;

  // Content Security Policy
  res.headers.set("Content-Security-Policy", buildCSP(origin));

  // Prevent MIME sniffing
  res.headers.set("X-Content-Type-Options", "nosniff");

  // Legacy clickjacking protection (CSP frame-ancestors already set)
  res.headers.set("X-Frame-Options", "DENY");

  // Reasonable referrer policy for sites with external links
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // Lock down powerful APIs by default
  res.headers.set(
    "Permissions-Policy",
    [
      "accelerometer=()",
      "ambient-light-sensor=()",
      "autoplay=()",
      "battery=()",
      "camera=()",
      "display-capture=()",
      "document-domain=()",
      "encrypted-media=()",
      "fullscreen=(self)",
      "geolocation=()",
      "gyroscope=()",
      "magnetometer=()",
      "microphone=()",
      "midi=()",
      "payment=()",
      "picture-in-picture=(self)",
      "publickey-credentials-get=()",
      "screen-wake-lock=()",
      "usb=()",
      "xr-spatial-tracking=()",
    ].join(", ")
  );

  // Cross-origin isolation knobs — choose conservative defaults to avoid breakage
  res.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  res.headers.set("Cross-Origin-Resource-Policy", "same-site");

  // HSTS (HTTPS only; safe on Vercel)
  if (hostname && hostname !== "localhost") {
    res.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload"
    );
  }
}

const legacy = new Set([
  "/sign-in",
  "/signin",
  "/auth/sign-in",
  "/sign-up",
  "/signup",
  "/auth/sign-up",
]);

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ---- 0) Canonical host redirect (RUN FIRST) ----
  // Prevents cookies/OAuth/schema URLs from ever being served on non-canonical hosts.
  const host = req.headers.get("host") || "";
  if (ENFORCED_HOSTS.has(host) && host !== CANONICAL_HOST) {
    const url = req.nextUrl.clone();
    url.host = CANONICAL_HOST;
    url.protocol = "https:";
    // 308 = method-preserving, OAuth-safe
    return NextResponse.redirect(url, 308);
  }

  // ---- 1) Legacy auth redirects ----
  if (legacy.has(pathname)) {
    const url = new URL("/login", req.url);
    return NextResponse.redirect(url);
  }

  // Only operate fully on /p/* pages below (but still add headers)
  const isProfilePage = pathname.startsWith("/p/");

  // Prepare the base response and apply headers
  const res = NextResponse.next();

  // ---- 2) Add Link header for JSON-LD association (HTML → JSON) ----
  if (isProfilePage) {
    const parts = pathname.split("/").filter(Boolean); // ["p", "slug", ...]
    const slug = parts[1];
    if (slug) {
      // Use canonical origin explicitly to avoid any future drift
      const canonicalOrigin = `https://${CANONICAL_HOST}`;
      res.headers.append(
        "Link",
        `<${canonicalOrigin}/api/profile/${encodeURIComponent(
          slug
        )}/schema>; rel="alternate"; type="application/ld+json"`
      );
    }
  }

  // ---- 3) Anti-enumeration (rate limit /p/* requests) ----
  if (
    isProfilePage &&
    ENABLE_ANTI_ENUM &&
    (req.method === "GET" || req.method === "HEAD")
  ) {
    const ip =
      req.ip ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown";

    try {
      if (
        process.env.UPSTASH_REDIS_REST_URL &&
        process.env.UPSTASH_REDIS_REST_TOKEN
      ) {
        // Upstash rate limit (Edge-safe dynamic imports)
        const [{ Ratelimit }, { Redis }] = await Promise.all([
          import("@upstash/ratelimit"),
          import("@upstash/redis"),
        ]);

        const redis = Redis.fromEnv();
        const limiter = new Ratelimit({
          redis,
          limiter: Ratelimit.slidingWindow(PROBE_LIMIT_PER_MIN, "1 m"),
          prefix: "aeo:rl:p",
        });

        const key = `ip:${ip}`;
        const { success } = await limiter.limit(key);

        if (!success) {
          const url = req.nextUrl.clone();
          url.pathname = TARPIT_PATH;
          url.search = "";
          const blocked = NextResponse.rewrite(url, {
            headers: { "Cache-Control": "no-store" },
          });
          applySecurityHeaders(req, blocked);
          return blocked;
        }
      } else {
        // Cookie-based soft limiter (best-effort fallback)
        const cookieName = "aeo_peek";
        const now = Date.now();
        const windowMs = 60_000;

        let count = 0;
        let windowStart = now;

        const cookieVal = req.cookies.get(cookieName)?.value;
        if (cookieVal) {
          try {
            const parsed = JSON.parse(cookieVal);
            windowStart = parsed.s || now;
            count = parsed.c || 0;
            if (now - windowStart > windowMs) {
              windowStart = now;
              count = 0;
            }
          } catch {
            // ignore parse errors
          }
        }

        count += 1;
        const tooMany = count > PROBE_LIMIT_PER_MIN;

        res.cookies.set(cookieName, JSON.stringify({ s: windowStart, c: count }), {
          path: "/",
          httpOnly: false, // deterrent only
          sameSite: "lax",
          secure: true,
          maxAge: 60, // seconds
        });

        if (tooMany) {
          const url = req.nextUrl.clone();
          url.pathname = TARPIT_PATH;
          url.search = "";
          const blocked = NextResponse.rewrite(url, {
            headers: { "Cache-Control": "no-store" },
          });
          applySecurityHeaders(req, blocked);
          return blocked;
        }
      }
    } catch {
      // Fail open on limiter errors to avoid accidental blocking
    }
  }

  // Always apply security headers on the way out
  applySecurityHeaders(req, res);
  return res;
}

export const config = {
  // Apply to broad HTML routes, but avoid API routes and Next internals.
  matcher: [
    "/((?!api/|_next/|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|txt|woff|woff2|ttf|eot)).*)",
  ],
};
