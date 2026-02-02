// middleware.ts
// Updated: 2026-02-02
// - ADD: Safe, fail-open Vercel KV IP rate limiting for /api/auth/* and /api/verify/* (incl bio-code generate/check)
// - KEEP: Canonical host enforcement (aeobro.com + aeobro.vercel.app -> www.aeobro.com)
// - KEEP: legacy auth redirects, Link header on /p/[slug], anti-enumeration
// - KEEP: security headers (CSP, HSTS, X-CTO, Referrer-Policy, Permissions-Policy, etc.)
// - KEEP: Edge-safe dynamic import() for Upstash libs
//
// Design goal: PUBLIC-LAUNCH HARDENING without breaking builds.
// - KV is imported dynamically and wrapped in try/catch (fail-open).
// - API limiting runs only when matcher includes /api/* routes.

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

// ---------- API Rate Limiting (Vercel KV, fail-open) ----------
type ApiRule = {
  name: string;
  limit: number; // max requests per window
  windowMs: number; // window size in ms
};

const API_RULES: Array<{ match: (path: string) => boolean; rule: ApiRule }> = [
  { match: (p) => p.startsWith("/api/auth/"), rule: { name: "auth", limit: 30, windowMs: 60_000 } },
  {
    match: (p) => p.startsWith("/api/verify/bio-code/generate"),
    rule: { name: "bio_generate", limit: 10, windowMs: 60_000 },
  },
  {
    match: (p) => p.startsWith("/api/verify/bio-code/check"),
    rule: { name: "bio_check", limit: 15, windowMs: 60_000 },
  },
  { match: (p) => p.startsWith("/api/verify/"), rule: { name: "verify", limit: 20, windowMs: 60_000 } },
];

function getClientIp(req: NextRequest): string {
  // Vercel often populates req.ip; fall back to headers.
  const direct = (req as any).ip as string | undefined;
  if (direct && typeof direct === "string" && direct.trim()) return direct.trim();

  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }

  // Deterministic fallback; still rate-limits “unknown” clients together.
  return "0.0.0.0";
}

function isApiRequest(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

function json429(params: {
  limit: number;
  remaining: number;
  resetEpochSeconds: number;
  retryAfterSeconds: number;
}) {
  const res = NextResponse.json(
    { ok: false, error: "rate_limited" },
    { status: 429 }
  );

  res.headers.set("x-ratelimit-limit", String(params.limit));
  res.headers.set("x-ratelimit-remaining", String(Math.max(0, params.remaining)));
  res.headers.set("x-ratelimit-reset", String(params.resetEpochSeconds));
  res.headers.set("retry-after", String(params.retryAfterSeconds));
  res.headers.set("cache-control", "no-store");
  return res;
}

async function rateLimitFixedWindowKV(args: {
  keyPrefix: string;
  ip: string;
  limit: number;
  windowMs: number;
}): Promise<
  | { allowed: true; limit: number; remaining: number; resetEpochSeconds: number }
  | { allowed: false; limit: number; remaining: number; resetEpochSeconds: number; retryAfterSeconds: number }
  | { allowed: "kv_unavailable" }
> {
  const now = Date.now();
  const windowId = Math.floor(now / args.windowMs);
  const ttlSeconds = Math.ceil(args.windowMs / 1000);
  const key = `rl:${args.keyPrefix}:${args.ip}:${windowId}`;

  try {
    // Dynamic import to reduce build/runtime fragility.
    // If KV isn't configured or the package isn't available at runtime, we fail-open.
    const mod = await import("@vercel/kv");
    const kv = (mod as any).kv as {
      incr: (k: string) => Promise<number>;
      expire: (k: string, s: number) => Promise<number | boolean>;
    };

    if (!kv?.incr || !kv?.expire) return { allowed: "kv_unavailable" };

    const count = await kv.incr(key);
    if (count === 1) {
      await kv.expire(key, ttlSeconds);
    }

    const windowEndMs = (windowId + 1) * args.windowMs;
    const resetEpochSeconds = Math.ceil(windowEndMs / 1000);

    if (count > args.limit) {
      const retryAfterSeconds = Math.max(1, Math.ceil((windowEndMs - now) / 1000));
      return {
        allowed: false,
        limit: args.limit,
        remaining: 0,
        resetEpochSeconds,
        retryAfterSeconds,
      };
    }

    return {
      allowed: true,
      limit: args.limit,
      remaining: Math.max(0, args.limit - count),
      resetEpochSeconds,
    };
  } catch {
    return { allowed: "kv_unavailable" };
  }
}

// ---------- CSP / Security Headers ----------
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

function applySecurityHeaders(req: NextRequest, res: NextResponse) {
  const { origin, hostname } = req.nextUrl;

  res.headers.set("Content-Security-Policy", buildCSP(origin));
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

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

  res.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  res.headers.set("Cross-Origin-Resource-Policy", "same-site");

  if (hostname && hostname !== "localhost") {
    res.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload"
    );
  }
}

// ---------- Legacy redirects ----------
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
  const host = req.headers.get("host") || "";
  if (ENFORCED_HOSTS.has(host) && host !== CANONICAL_HOST) {
    const url = req.nextUrl.clone();
    url.host = CANONICAL_HOST;
    url.protocol = "https:";
    return NextResponse.redirect(url, 308);
  }

  // ---- 1) Legacy auth redirects ----
  if (legacy.has(pathname)) {
    const url = new URL("/login", req.url);
    return NextResponse.redirect(url);
  }

  // ---- 2) API rate limiting (only for matched API routes) ----
  if (isApiRequest(pathname)) {
    const matched = API_RULES.find((r) => r.match(pathname));
    if (matched) {
      const ip = getClientIp(req);
      const { rule } = matched;

      const result = await rateLimitFixedWindowKV({
        keyPrefix: rule.name,
        ip,
        limit: rule.limit,
        windowMs: rule.windowMs,
      });

      // Fail-open if KV is unavailable; still annotate (non-sensitive).
      if (result.allowed === "kv_unavailable") {
        const res = NextResponse.next();
        res.headers.set("x-ratelimit", "kv_unavailable");
        applySecurityHeaders(req, res);
        return res;
      }

      if (!result.allowed) {
        const blocked = json429({
          limit: result.limit,
          remaining: result.remaining,
          resetEpochSeconds: result.resetEpochSeconds,
          retryAfterSeconds: result.retryAfterSeconds,
        });
        applySecurityHeaders(req, blocked);
        return blocked;
      }

      const res = NextResponse.next();
      res.headers.set("x-ratelimit-limit", String(result.limit));
      res.headers.set("x-ratelimit-remaining", String(result.remaining));
      res.headers.set("x-ratelimit-reset", String(result.resetEpochSeconds));
      applySecurityHeaders(req, res);
      return res;
    }

    // Unmatched API routes: pass through, but keep security headers.
    const res = NextResponse.next();
    applySecurityHeaders(req, res);
    return res;
  }

  // ---- 3) Non-API behavior (existing logic) ----
  const isProfilePage = pathname.startsWith("/p/");
  const res = NextResponse.next();

  // ---- 4) Add Link header for JSON-LD association (HTML → JSON) ----
  if (isProfilePage) {
    const parts = pathname.split("/").filter(Boolean); // ["p", "slug", ...]
    const slug = parts[1];
    if (slug) {
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
    const ip =
      req.ip ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown";

    try {
      if (
        process.env.UPSTASH_REDIS_REST_URL &&
        process.env.UPSTASH_REDIS_REST_TOKEN
      ) {
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

  applySecurityHeaders(req, res);
  return res;
}

export const config = {
  matcher: [
    // ✅ NEW: ensure middleware runs on API routes we want to protect
    "/api/:path*",

    // ✅ Existing: broad HTML routes, but avoid Next internals + static assets
    "/((?!api/|_next/|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|txt|woff|woff2|ttf|eot)).*)",
  ],
};
