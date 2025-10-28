// lib/getClientRateKey.ts
import { headers } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * Generates a per-user or per-IP rate-limit key.
 * - If NextAuth session exists, prefer a stable user identifier:
 *   - user.id (if your app augments NextAuth types / JWT),
 *   - otherwise user.email.
 * - If no session, fall back to client IP.
 */
export async function getClientRateKey(prefix: string) {
  const session = await getServerSession(authOptions);

  // Prefer user.id if your app sets it on the session (cast to any to avoid TS error).
  const userId = (session as any)?.user?.id as string | undefined;
  const userEmail = session?.user?.email ?? undefined;

  if (userId) {
    return `${prefix}:uid:${userId}`;
  }
  if (userEmail) {
    return `${prefix}:email:${userEmail}`;
  }

  const h = headers();
  const ipRaw =
    h.get("x-forwarded-for") ||
    h.get("x-real-ip") ||
    h.get("cf-connecting-ip") ||
    "unknown";
  const ip = ipRaw.split(",")[0].trim();

  return `${prefix}:ip:${ip}`;
}
