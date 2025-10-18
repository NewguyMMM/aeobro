// lib/verifyTurnstile.ts

// Keep the result type flexible so the build doesn't break on edge cases.
// You can tighten this later if you want strict discriminated unions.
export type VerifyResult = {
  ok: boolean;
  raw?: any;
  reason?: string;
};

/**
 * Verify a Cloudflare Turnstile token server-side.
 * Returns { ok: true } when challenge is passed.
 */
export async function verifyTurnstileToken(responseToken?: string): Promise<VerifyResult> {
  if (!responseToken) return { ok: false, reason: "missing_token" };

  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.error("TURNSTILE_SECRET_KEY is not set");
    return { ok: false, reason: "server_misconfig" };
  }

  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: responseToken }),
    });

    const data = await res.json();

    if (data?.success) {
      return { ok: true, raw: data };
    }

    // When not successful, Turnstile includes error-codes; surface one if present.
    const code = Array.isArray(data?.["error-codes"]) ? data["error-codes"][0] : undefined;
    return { ok: false, reason: code || "challenge_failed", raw: data };
  } catch (err) {
    console.error("Turnstile verify error", err);
    return { ok: false, reason: "network_error" };
  }
}

/**
 * Read the Turnstile token from a Next.js App Router Request and verify it.
 * Supports both `application/json` and form posts (multipart/urlencoded).
 */
export async function extractAndVerifyFromRequest(req: Request): Promise<VerifyResult> {
  const ct = req.headers.get("content-type") || "";

  try {
    if (ct.includes("application/json")) {
      const body = await req.clone().json().catch(() => ({} as any));
      return verifyTurnstileToken(body?.["cf-turnstile-response"]);
    } else {
      const form = await req.clone().formData().catch(() => undefined);
      const token = form?.get("cf-turnstile-response") as string | undefined;
      return verifyTurnstileToken(token);
    }
  } catch {
    return { ok: false, reason: "parse_error" };
  }
}
