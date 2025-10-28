// lib/getClientRateKey.ts
import { headers } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * Generates a per-user or per-IP rate-limit key.
 * - Authenticated users → user ID
 * - Guests → IP address
 */
export async function getClientRateKey(prefix: string) {
  const session = await getServerSession(authOptions);
  if (session?.user?.id) return `${prefix}:uid:${session.user.id}`;

  const h = headers();
  const ipRaw =
    h.get("x-forwarded-for") ||
    h.get("x-real-ip") ||
    h.get("cf-connecting-ip") ||
    "unknown";
  const ip = ipRaw.split(",")[0].trim();
  return `${prefix}:ip:${ip}`;
}
