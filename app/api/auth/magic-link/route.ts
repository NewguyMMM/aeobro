import { NextResponse } from "next/server";
import { verifyTurnstileToken } from "@/lib/verifyTurnstile";

/**
 * Verifies Turnstile, then 307-redirects the original POST
 * to NextAuth's built-in email sign-in endpoint.
 *
 * Your form posts here:
 *   <form method="POST" action="/api/auth/magic-link"> … </form>
 * with fields: email, turnstileToken
 */
export async function POST(req: Request) {
  // Accept either application/x-www-form-urlencoded (form) or JSON
  let email = "";
  let turnstileToken = "";

  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    email = String(form.get("email") || "");
    turnstileToken = String(form.get("turnstileToken") || "");
  } else {
    const json = await req.json().catch(() => ({} as any));
    email = String(json?.email || "");
    turnstileToken = String(json?.turnstileToken || "");
  }

  if (!email) {
    return NextResponse.json({ error: "Missing email" }, { status: 400 });
  }
  if (!turnstileToken) {
    return NextResponse.json({ error: "Missing CAPTCHA" }, { status: 400 });
  }

  const ok = await verifyTurnstileToken(turnstileToken);
  if (!ok) {
    return NextResponse.json({ error: "CAPTCHA failed" }, { status: 400 });
  }

  // Hand off to NextAuth's native email endpoint, preserving the POST body.
  // 307 keeps the method & body intact; NextAuth will ignore extra fields.
  const target = new URL("/api/auth/signin/email", req.url);
  return NextResponse.redirect(target, { status: 307 });
}
