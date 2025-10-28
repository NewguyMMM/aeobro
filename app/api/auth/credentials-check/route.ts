import { NextResponse } from "next/server";
import { verifyTurnstileToken } from "@/lib/verifyTurnstile";

/**
 * Verifies Turnstile, then 307-redirects the original POST
 * to NextAuth's built-in credentials callback endpoint.
 *
 * Your form posts here:
 *   <form method="POST" action="/api/auth/credentials-check"> … </form>
 * with fields: email, password, turnstileToken
 */
export async function POST(req: Request) {
  let email = "";
  let password = "";
  let turnstileToken = "";

  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    email = String(form.get("email") || "");
    password = String(form.get("password") || "");
    turnstileToken = String(form.get("turnstileToken") || "");
  } else {
    const json = await req.json().catch(() => ({} as any));
    email = String(json?.email || "");
    password = String(json?.password || "");
    turnstileToken = String(json?.turnstileToken || "");
  }

  if (!email || !password) {
    return NextResponse.json({ error: "Missing credentials" }, { status: 400 });
  }
  if (!turnstileToken) {
    return NextResponse.json({ error: "Missing CAPTCHA" }, { status: 400 });
  }

  const ok = await verifyTurnstileToken(turnstileToken);
  if (!ok) {
    return NextResponse.json({ error: "CAPTCHA failed" }, { status: 400 });
  }

  // Forward to NextAuth's credentials callback, preserving POST & body.
  const target = new URL("/api/auth/callback/credentials", req.url);
  return NextResponse.redirect(target, { status: 307 });
}
