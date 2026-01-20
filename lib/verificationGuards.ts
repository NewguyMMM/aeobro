// lib/verificationGuards.ts
// ✅ Added: 2026-01-19
// Central, server-side enforcement for verification modalities.
// Goals:
// - If a provider isn't selectable in UI, server rejects it.
// - Prevent impossible provider ↔ platformContext states.
// - Keep error responses clean (no leaking tokens/URLs).

export type VerificationContext = "BIO_CODE" | "OAUTH" | "DNS_TXT";

export const ALLOWED_BIO_CODE_PROVIDERS = new Set(["github", "x", "substack", "etsy"]);

// Keep in sync with your Verification UI (OAuth buttons)
// Current: Google/YouTube, Facebook, X
// NextAuth uses provider IDs like "google", "facebook", "twitter" (or "x") depending on config.
export const ALLOWED_OAUTH_PROVIDERS = new Set([
  "google",
  "facebook",
  "twitter", // common NextAuth id
  "x",       // if you configured a custom provider id
  "youtube", // if you separately modeled it (most setups don't)
]);

// Deterministic pairing rules to prevent schema rot
export function assertProviderAllowedForContext(
  providerRaw: unknown,
  contextRaw: unknown
): { ok: true; provider: string; context: VerificationContext } | { ok: false; error: string } {
  const provider = typeof providerRaw === "string" ? providerRaw.trim().toLowerCase() : "";
  const context = contextRaw as VerificationContext;

  if (!provider) return { ok: false, error: "Missing provider." };
  if (!context || !["BIO_CODE", "OAUTH", "DNS_TXT"].includes(String(context)))
    return { ok: false, error: "Missing or invalid platformContext." };

  // Block nonsense providers early (domain, dns, etc should never be a PlatformAccount provider)
  if (provider === "domain" || provider === "dns" || provider === "txt") {
    return { ok: false, error: "Invalid provider for PlatformAccount." };
  }

  if (context === "BIO_CODE") {
    if (!ALLOWED_BIO_CODE_PROVIDERS.has(provider)) {
      return { ok: false, error: "Unsupported platform for Code-in-Bio." };
    }
    return { ok: true, provider, context };
  }

  if (context === "OAUTH") {
    if (!ALLOWED_OAUTH_PROVIDERS.has(provider)) {
      return { ok: false, error: "Unsupported provider for OAuth." };
    }
    return { ok: true, provider, context };
  }

  if (context === "DNS_TXT") {
    // DNS TXT verification should not create PlatformAccounts at all.
    return { ok: false, error: "DNS verification cannot be stored as a PlatformAccount." };
  }

  return { ok: false, error: "Invalid verification context." };
}
