// middleware.ts
// Updated: 2025-10-29 10:59 ET
// - Fix TypeScript cookie option casing: sameSite: "lax" (was "Lax")
// - Use Edge-safe dynamic import() for Upstash libs
// - Preserve: legacy auth redirects, Link header on /p/[slug], anti-enumeration

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// ---------- Config ----------
const PROBE_LIMIT_PER_MIN =
  parseInt(process.env.AEO_PROBE_LIMIT_PER_MIN || "", 10) || 30;
const TARPIT_PATH = "/tarpit";
const ENABLE_ANTI_ENUM = (process.env.AEO_ANTI_ENUM ?? "1") !== "0";

const legacy = new Set([
  "/sign-in",
  "/signin",
  "/auth/sign-in",
  "/sign-up",
  "/signup",
  "/auth/sign-up",
]);

export async function middleware(req: NextRequest) {
  const { pathname, origin } = req.nextUrl;

  // ---- 1) Legacy auth redirects ----
  if (legacy.has(pathname)) {
    const url = new URL("/login", req.url);
    return NextResponse.redirect(url);
  }

  // Only operate on /p/* pages below
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
      // Prefer robust Upstash limiter if configured
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
          return NextResponse.rewrite(url, {
            headers: { "Cache-Control": "no-store" },
          });
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

            // Reset window if expired
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

        // ✅ FIX: sameSite must be lowercase ("lax" | "strict" | "none")
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
          return NextResponse.rewrite(url, {
            headers: { "Cache-Control": "no-store" },
          });
        }
      }
    } catch {
      // Fail open on limiter errors to avoid accidental blocking
    }
  }

  return res;
}

export const config = {
  matcher: [
    "/sign-in",
    "/signin",
    "/auth/sign-in",
    "/sign-up",
    "/signup",
    "/auth-sign-up",
    "/p/:path*",
  ],
};
