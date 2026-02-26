// middleware.ts
// Updated: 2026-02-26 (HOTFIX: stop redirect loop, keep prior stable canonical host)
// - KEEP: API abuse rate limiting for /api/auth/* and /api/verify/* using Upstash (Edge-safe dynamic imports)
// - KEEP: Canonical host enforcement to www.aeobro.com (this matches prior stable behavior)
// - KEEP: legacy auth redirects, Link header on /p/[slug], anti-enumeration
// - KEEP: security headers (CSP, HSTS, X-CTO, Referrer-Policy, Permissions-Policy, etc.)
// - KEEP: Edge-safe dynamic import() for Upstash libs
//
// NOTE:
// - Rate limiting is FAIL-OPEN.
// - Canonical redirect is method-preserving (308) and runs FIRST.
// - Adds /api/_debug/* to matcher (so debug endpoints can be used safely).

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// ---------- Canonical Host Enforcement ----------
const CANONICAL_HOST = "www.aeobro.com";

// Only enforce for these exact hosts (so preview deployments are not affected)
const ENFORCED_HOSTS = new Set(["aeobro.com", "aeobro.vercel.app"]);

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
  const upgrade = origin.startsWith("https://")
    ? "upgrade-insecure-requests; "
    : "";

  return [
    upgrade,
    "default-src 'self';",
    "base-uri 'none';",
    "object-src 'none';",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval';",
    "style-src 'self' 'unsafe-inline';",
    `img-src ${IMG_SRC};`,
    `font-src ${FONT_SRC};`,
    `connect-src ${CONNECT_SRC};`,
    "frame-ancestors 'none';",
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
    { status: 429, headers: { "Cache-Control": "no-store" } }
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
    return "unavailable"; // FAIL-OPEN
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ---- 0) Canonical host redirect (RUN FIRST) ----
  // Redirect ONLY when request is on an enforced host.
  const hostHeader = req.headers.get("host") || "";
  const host = hostHeader.split(":")[0]; // defensive (ports)

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

  // ---- 2) API abuse rate limiting (Upstash, fail-open) ----
  if (pathname.startsWith("/api/auth/") || pathname.startsWith("/api/verify/")) {
    const ip = getClientIp(req);

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

    const res = NextResponse.next();
    if (decision === "unavailable") res.headers.set("x-ratelimit", "unavailable");
    applySecurityHeaders(req, res);
    return res;
  }

  // ---- 3) HTML route behavior ----
  const isProfilePage = pathname.startsWith("/p/");
  const res = NextResponse.next();

  // ---- 4) Link header for JSON-LD association ----
  if (isProfilePage) {
    const parts = pathname.split("/").filter(Boolean);
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

  // ---- 5) Anti-enumeration ----
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

        const { success } = await limiter.limit(`ip:${ip}`);

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
          } catch {}
        }

        count += 1;
        const tooMany = count > PROBE_LIMIT_PER_MIN;

        res.cookies.set(cookieName, JSON.stringify({ s: windowStart, c: count }), {
          path: "/",
          httpOnly: false,
          sameSite: "lax",
          secure: true,
          maxAge: 60,
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
      // Fail open
    }
  }

  applySecurityHeaders(req, res);
  return res;
}

export const config = {
  matcher: [
    "/api/auth/:path*",
    "/api/verify/:path*",
    "/api/_debug/:path*",
    "/((?!api/|_next/|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|txt|woff|woff2|ttf|eot)).*)",
  ],
};
