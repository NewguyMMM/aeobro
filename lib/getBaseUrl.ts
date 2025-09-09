// lib/getBaseUrl.ts
/**
 * Returns the canonical origin of the app.
 * Priority:
 * 1) NEXT_PUBLIC_APP_URL (set this in Vercel to your full https URL)
 * 2) VERCEL_URL (Vercel-provided host, we add https://)
 * 3) http://localhost:3000 (local dev)
 */
export function getBaseUrl(): string {
  // Trim any trailing slashes to avoid double // when concatenating
  const trim = (s?: string | null) => (s ? s.replace(/\/+$/, "") : "");

  const publicUrl = trim(process.env.NEXT_PUBLIC_APP_URL);
  if (publicUrl) return publicUrl;

  const vercelUrl = trim(process.env.VERCEL_URL);
  if (vercelUrl) return `https://${vercelUrl}`;

  return "http://localhost:3000";
}
