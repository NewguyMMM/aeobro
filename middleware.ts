// middleware.ts
// Updated: 2025-10-29 10:14 ET
// - Keep legacy auth route redirects → /login
// - Add HTTP `Link: <.../api/profile/[slug]/schema>; rel="alternate"; type="application/ld+json"`
//   for all human profile pages at /p/[slug]. No UI changes, header only.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname, origin } = req.nextUrl;

  // ---- 1) Legacy auth redirects ----
  const legacy = new Set([
    "/sign-in",
    "/signin",
    "/auth/sign-in",
    "/sign-up",
    "/signup",
    "/auth/sign-up",
  ]);
  if (legacy.has(pathname)) {
    const url = new URL("/login", req.url);
    return NextResponse.redirect(url);
  }

  // ---- 2) Add Link header on human profile pages (/p/[slug]) ----
  if (pathname.startsWith("/p/")) {
    // pathname like /p/manny or /p/manny/...
    const parts = pathname.split("/").filter(Boolean); // ["p", "slug", ...]
    const slug = parts[1];

    if (slug) {
      const res = NextResponse.next();
      // Point crawlers/agents to the canonical raw JSON-LD for this specific page
      res.headers.append(
        "Link",
        `<${origin}/api/profile/${encodeURIComponent(
          slug
        )}/schema>; rel="alternate"; type="application/ld+json"`
      );
      return res;
    }
  }

  // Default pass-through
  return NextResponse.next();
}

export const config = {
  // Match legacy auth routes (for redirects) and public profile pages (for Link header)
  matcher: [
    "/sign-in",
    "/signin",
    "/auth/sign-in",
    "/sign-up",
    "/signup",
    "/auth/sign-up",
    "/p/:path*", // apply header on /p/[slug]
  ],
};
