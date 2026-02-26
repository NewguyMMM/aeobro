// middleware.ts
// Updated: 2026-02-26
// - RECONCILE: Canonical host enforcement now points to apex (aeobro.com) to match NEXTAUTH_URL
// - KEEP: API abuse rate limiting for /api/auth/* and /api/verify/* using Upstash (Edge-safe dynamic imports)
// - KEEP: legacy auth redirects, Link header on /p/[slug], anti-enumeration
// - KEEP: security headers (CSP, HSTS, X-CTO, Referrer-Policy, Permissions-Policy, etc.)
// - KEEP: Edge-safe dynamic import() for Upstash libs
//
// IMPORTANT:
// - Rate limiting remains FAIL-OPEN (never blocks if limiter errors or env is missing).
// - Canonical redirect is method-preserving (308) and runs FIRST.
// - Matcher is minimally extended to include /api/_debug/* for canonical redirect consistency.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// ---------- Canonical Host Enforcement ----------
// ✅ Canonical host is now APEX to match NEXTAUTH_URL=https://aeobro.com
const CANONICAL_HOST = "aeobro.com";

// Only enforce for these exact hosts (so preview deployments are not affected)
const ENFORCED_HOSTS = new Set(["www.aeobro.com", "aeobro.vercel.app"]);

// ---------- Tunables ----------
const PROBE_LIMIT_PER_MIN =
  parseInt(process.env.AEO_PROBE_LIMIT_PER_MIN || "", 10) || 30;

const AUTH_LIMIT_PER_MIN =
  parseInt(process.env.AEO_AUTH_LIMIT_PER_MIN || "", 10) || 30;

const VERIFY_LIMIT_PER_MIN =
  parseInt(process.env.AEO_VERIFY_LIMIT_PER_MIN || "", 10) || 20;

const BIOGEN_LIMIT_PER_MIN =
  parseInt(process.env.AEO_BIOGEN_LIMIT_PER_MIN || "", 10) || 10;

const BIOCHECK_LIMIT_PER_MIN =
  parseInt(process.env.AEO_BIOCHECK_LIMIT_PER_MIN || "", 10) || 15;

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

function getClientIp(req: NextRequest): string {
  return (
    req.ip ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

function json429() {
  return NextResponse.json(
    { ok: false, error: "rate_limited" },
    {
      status: 429,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}

async function upstashLimitOrPass(args: {
  prefix: string;
  limitPerMin: number;
  ip: string;
}): Promise<"allow" | "block" | "unavailable"> {
  try {
    if (
      !process.env.UPSTASH_REDIS_REST_URL ||
      !process.env.UPSTASH_REDIS_REST_TOKEN
    ) {
      return "unavailable";
    }

    const [{ Ratelimit }, { Redis }] = await Promise.all([
      import("@upstash/ratelimit"),
      import("@upstash/redis"),
    ]);

    const redis = Redis.fromEnv();
    const limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(args.limitPerMin, "1 m"),
      prefix: args.prefix,
    });

    const { success } = await limiter.limit(`ip:${args.ip}`);
    return success ? "allow" : "block";
  } catch {
    // FAIL-OPEN
    return "unavailable";
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ---- 0) Canonical host redirect (RUN FIRST) ----
  // Prevent cookies/OAuth/schema URLs from ever being served on non-canonical hosts.
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

  // ---- 2) API abuse rate limiting (Upstash, fail-open) ----
  // Applies ONLY to the abusable endpoints needed for public launch.
  if (pathname.startsWith("/api/auth/") || pathname.startsWith("/api/verify/")) {
    const ip = getClientIp(req);

    // Choose rule bucket
    let bucketPrefix = "aeo:rl:api";
    let limit = VERIFY_LIMIT_PER_MIN;

    if (pathname.startsWith("/api/auth/")) {
      bucketPrefix = "aeo:rl:auth";
      limit = AUTH_LIMIT_PER_MIN;
    } else if (pathname.startsWith("/api/verify/bio-code/generate")) {
      bucketPrefix = "aeo:rl:biogen";
      limit = BIOGEN_LIMIT_PER_MIN;
    } else if (pathname.startsWith("/api/verify/bio-code/check")) {
      bucketPrefix = "aeo:rl:biocheck";
      limit = BIOCHECK_LIMIT_PER_MIN;
    } else {
      bucketPrefix = "aeo:rl:verify";
      limit = VERIFY_LIMIT_PER_MIN;
    }

    const decision = await upstashLimitOrPass({
      prefix: bucketPrefix,
      limitPerMin: limit,
      ip,
    });

    if (decision === "block") {
      const blocked = json429();
      applySecurityHeaders(req, blocked);
      return blocked;
    }

    // allow or unavailable -> pass through
    const res = NextResponse.next();
    if (decision === "unavailable") {
      res.headers.set("x-ratelimit", "unavailable");
    }
    applySecurityHeaders(req, res);
    return res;
  }

  // ---- 3) HTML route behavior (existing logic) ----
  const isProfilePage = pathname.startsWith("/p/");

  // Prepare the base response and apply headers
  const res = NextResponse.next();

  // ---- 4) Add Link header for JSON-LD association (HTML → JSON) ----
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

  // ---- 5) Anti-enumeration (rate limit /p/* requests) ----
  if (
    isProfilePage &&
    ENABLE_ANTI_ENUM &&
    (req.method === "GET" || req.method === "HEAD")
  ) {
    const ip = getClientIp(req);

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
  matcher: [
    // ✅ Apply to the API routes we are protecting
    "/api/auth/:path*",
    "/api/verify/:path*",

    // ✅ Ensure canonical redirect also applies to debug endpoints (optional but safe)
    "/api/_debug/:path*",

    // ✅ Apply to broad HTML routes, but avoid Next internals and static assets.
    "/((?!api/|_next/|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|txt|woff|woff2|ttf|eot)).*)",
  ],
};
