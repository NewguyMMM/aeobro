// lib/getBaseUrl.ts

/**
 * Returns the canonical origin of the app (no trailing slash).
 *
 * Priority:
 * 1) NEXT_PUBLIC_APP_URL  (set this in Vercel to your full https URL, e.g. https://aeobro.com)
 * 2) Runtime headers (x-forwarded-proto/host) when available (App Router server/runtime)
 * 3) VERCEL_URL           (Vercel-provided host; we prefix https://)
 * 4) http://localhost:3000 (local dev)
 *
 * Notes:
 * - Never returns a trailing slash.
 * - Safe to import in both server and edge runtimes. The headers-based helper
 *   is only used if Next's headers() API is available at call time.
 */

function trimTrailingSlash(s?: string | null) {
  return s ? s.replace(/\/+$/, "") : "";
}

function ensureProtocol(urlOrHost: string): string {
  // If it already looks like a full origin, return normalized.
  if (/^https?:\/\//i.test(urlOrHost)) return trimTrailingSlash(urlOrHost)!;
  // Otherwise treat as host and assume https in production-like contexts.
  return `https://${trimTrailingSlash(urlOrHost)}`;
}

/** Env-first resolution (does not inspect request headers). */
export function getBaseUrl(): string {
  // Highest priority: explicitly configured canonical URL
  const publicUrl = trimTrailingSlash(process.env.NEXT_PUBLIC_APP_URL);
  if (publicUrl) return publicUrl;

  // Next best: Vercel-provided host (preview/prod)
  const vercelHost = trimTrailingSlash(process.env.VERCEL_URL);
  if (vercelHost) return ensureProtocol(vercelHost);

  // Local dev fallback
  return "http://localhost:3000";
}

/**
 * Attempts to derive the origin from a Headers object (server/edge),
 * falling back to env if unavailable. Never throws.
 *
 * Usage from a route/page (server):
 *   import { headers } from "next/headers";
 *   const origin = getBaseUrlFromHeaders(headers());
 */
export function getBaseUrlFromHeaders(hdrs?: Headers | null): string {
  // If env is explicitly set, honor it (canonical).
  const env = trimTrailingSlash(process.env.NEXT_PUBLIC_APP_URL);
  if (env) return env;

  try {
    const host = trimTrailingSlash(hdrs?.get("x-forwarded-host") || hdrs?.get("host"));
    if (host) {
      const proto = (hdrs?.get("x-forwarded-proto") || "https").toLowerCase();
      const origin = `${proto}://${host}`;
      return trimTrailingSlash(origin)!;
    }
  } catch {
    // ignore and fall back
  }

  // Fall back to Vercel/localhost chain.
  return getBaseUrl();
}

/**
 * Convenience helper for server components/route handlers:
 * tries Next's headers() if available at runtime; otherwise falls back to env.
 *
 * Example:
 *   const origin = await getRuntimeBaseUrl();
 */
export async function getRuntimeBaseUrl(): Promise<string> {
  // Prefer explicit env if present.
  if (process.env.NEXT_PUBLIC_APP_URL) return getBaseUrl();

  // Dynamically import to avoid bundling issues in non-server contexts.
  try {
    // eslint-disable-next-line @typescript-eslint/consistent-type-imports
    const mod = await import("next/headers");
    const hdrs: Headers | undefined = (mod as any)?.headers?.();
    return getBaseUrlFromHeaders(hdrs ?? null);
  } catch {
    return getBaseUrl();
  }
}
