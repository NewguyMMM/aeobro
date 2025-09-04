import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const p = req.nextUrl.pathname;
  const legacy = new Set([
    "/sign-in",
    "/signin",
    "/auth/sign-in",
    "/sign-up",
    "/signup",
    "/auth/sign-up",
  ]);
  if (legacy.has(p)) {
    const url = new URL("/login", req.url);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/sign-in", "/signin", "/auth/sign-in", "/sign-up", "/signup", "/auth/sign-up"],
};
