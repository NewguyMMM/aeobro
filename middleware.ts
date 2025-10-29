// middleware.ts
// Updated: 2025-10-29 10:36 ET
// - Legacy auth redirects → /login
// - Add HTTP Link header: <.../api/profile/[slug]/schema>; rel="alternate"; type="application/ld+json" on /p/[slug]
// - Anti-enumeration: rate-limit probes on /p/*
//   • Preferred: Upstash Redis (env: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN)
//   • Fallback: Cookie-based soft limiter (per-IP-ish via client) if Upstash not configured
//
// When a client exceeds the threshold, we rewrite to /tarpit (200 OK) to avoid leak via 404-counting.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// ---------- Config ----------
const PROBE_LIMIT_PER_MIN = parseInt(process.env.AEO_PROBE_LIMIT_PER_MIN || "", 10) || 30; // reasonable default
const TARPIT_PATH = "/tarpit";
const ENABLE_ANTI_ENUM = (process.env.AEO_ANTI_ENUM ?? "1") !== "0";

// ---------- Optional Upstash ----------
let useUpstash = false;
let Ratelimit: any;
let Redis: any;

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  useUpstash = true;
  // Lazy import at edge
  // @ts-ignore
  Ratelimit = require("@upstash/ratelimit").Ratelimit;
  // @ts-ignore
  Redis = require("@upstash/redis").Redis;
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
  const { pathname, origin, search } = req.nextUrl;

  // ---- 1) Legacy auth redirects ----
  if (legacy.has(pathname)) {
    const url = new URL("/login", req.url);
    return NextResponse.redirect(url);
  }

  // Only operate on /p/* pages for the features below
  const isProfilePage = pathname.startsWith("/p/");
  if (!isProfilePage) {
    return NextResponse.next();
  }

  // Extract slug for /p/[slug]/...
  const parts = pathname.split("/").filter(Boolean); // ["p", "slug", ...]
  const slug = parts[1];
  const res = NextResponse.next();

  // ---- 2) Add Link header for JSON-LD association (HTML → JSON) ----
  if (slug) {
    res.headers.append(
      "Link",
      `<${origin}/api/profile/${encodeURIComponent(
        slug
      )}/schema>; rel="alternate"; type="application/ld+json"`
    );
  }

  // ---- 3) Anti-enumeration (rate limit /p/* requests) ----
  if (ENABLE_ANTI_ENUM && (req.method === "GET" || req.method === "HEAD")) {
    const ip =
      req.ip ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown";

    try {
      if (useUpstash) {
        // Robust IP rate limit using Upstash
        const redis = Redis.fromEnv();
        const limiter = new Ratelimit({
          redis,
          limiter: Ratelimit.slidingWindow(PROBE_LIMIT_PER_MIN, "1 m"),
          prefix: "aeo:rl:p",
        });

        const key = `ip:${ip}`;
        const { success } = await limiter.limit(key);
        if (!success) {
          // Too many requests → rewrite to tarpit (200 OK)
          const url = req.nextUrl.clone();
          url.pathname = TARPIT_PATH;
          url.search = ""; // normalize
          return NextResponse.rewrite(url, {
            headers: {
              // Prevent caching of the tarpit response
              "Cache-Control": "no-store",
            },
          });
        }
      } else {
        // Cookie-based soft limiter (best-effort)
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

            // Reset window if expired
            if (now - windowStart > windowMs) {
              windowStart = now;
              count = 0;
            }
          } catch {}
        }

        count += 1;
        const tooMany = count > PROBE_LIMIT_PER_MIN;

        // Set/refresh cookie on the response we’re already returning
        res.cookies.set(
          cookieName,
          JSON.stringify({ s: windowStart, c: count }),
          {
            path: "/",
            httpOnly: false, // client-visible; this is a deterrent only
            sameSite: "Lax",
            secure: true,
            maxAge: 60, // seconds
          }
        );

        if (tooMany) {
          const url = req.nextUrl.clone();
          url.pathname = TARPIT_PATH;
          url.search = ""; // normalize
          return NextResponse.rewrite(url, {
            headers: { "Cache-Control": "no-store" },
          });
        }
      }
    } catch {
      // On any limiter error, fail open (return normal page) to avoid accidental blocking
    }
  }

  return res;
}

export const config = {
  // Apply to legacy auth routes (redirects) and all /p/* pages (headers + anti-enum)
  matcher: [
    "/sign-in",
    "/signin",
    "/auth/sign-in",
    "/sign-up",
    "/signup",
    "/auth/sign-up",
    "/p/:path*",
  ],
};
