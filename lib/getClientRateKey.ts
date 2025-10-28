// lib/getClientRateKey.ts
// Ensure this module is never bundled client-side.
import "server-only";

import { headers } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * Return a best-effort client IP string from common proxy headers.
 * Safe for server environments only.
 */
export function getClientIp(): string {
  const h = headers();
  const ipRaw =
    h.get("x-forwarded-for") ||
    h.get("x-real-ip") ||
    h.get("cf-connecting-ip") ||
    "unknown";
  return ipRaw.split(",")[0].trim() || "unknown";
}

/**
 * Generates a per-user or per-IP rate-limit key.
 * USE ONLY in API route handlers or server components.
 *
 * Priority:
 *  1) session.user.id (if your app adds it to the session)
 *  2) session.user.email
 *  3) client IP address
 */
export async function getClientRateKey(prefix: string) {
  let userId: string | undefined;
  let userEmail: string | undefined;

  try {
    const session = await getServerSession(authOptions);
    // If you've augmented NextAuth session, user.id may exist.
    userId = (session as any)?.user?.id as string | undefined;
    userEmail = session?.user?.email ?? undefined;
  } catch {
    // If NextAuth isn't available in this context, just fall back to IP below.
  }

  if (userId) return `${prefix}:uid:${userId}`;
  if (userEmail) return `${prefix}:email:${userEmail}`;

  const ip = getClientIp();
  return `${prefix}:ip:${ip}`;
}
