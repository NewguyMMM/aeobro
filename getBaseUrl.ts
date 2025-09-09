// lib/getBaseUrl.ts
export function getBaseUrl() {
  // Prefer explicit public URL; fall back to Vercel env; then localhost
  const envUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);

  return envUrl || "http://localhost:3000";
}
