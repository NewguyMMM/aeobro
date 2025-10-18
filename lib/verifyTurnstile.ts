// lib/verifyTurnstile.ts

type VerifyResult =
  | { ok: true; raw?: any }
  | { ok: false; reason: "missing_token" | "server_misconfig" | "network_error"; raw?: any };

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
      // Turnstile endpoint is external; no need for cache
    });

    const data = await res.json();
    return { ok: !!data.success, raw: data };
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

  let token: string | undefined;

  try {
    if (ct.includes("application/json")) {
      const body = await req.clone().json().catch(() => ({} as any));
      token = body["cf-turnstile-response"];
    } else {
      const form = await req.clone().formData().catch(() => undefined);
      token = form?.get("cf-turnstile-response") as string | undefined;
    }
  } catch (e) {
    // fall through with undefined token; downstream will return missing_token
  }

  return verifyTurnstileToken(token);
}
