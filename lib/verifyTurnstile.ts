export async function verifyTurnstileToken(responseToken?: string) {
  if (!responseToken) return { ok: false, reason: "missing_token" };
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return { ok: false, reason: "server_misconfig" };

  try {
    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ secret, response: responseToken }),
      }
    );
    const data = await res.json();
    return { ok: !!data.success, raw: data };
  } catch (e) {
    console.error("Turnstile verify error", e);
    return { ok: false, reason: "network_error" };
  }
}
