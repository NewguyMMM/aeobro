// lib/getClientRateKey.ts
// Ensure this can NEVER be imported by client components
import "server-only";

import { headers } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * Generates a per-user or per-IP rate-limit key.
 * USE ONLY IN: API route handlers or server components.
 */
export async function getClientRateKey(prefix: string) {
  const session = await getServerSession(authOptions);

  // Prefer user.id if you add it to the session; else email.
  const userId = (session as any)?.user?.id as string | undefined;
  const userEmail = session?.user?.email ?? undefined;

  if (userId) return `${prefix}:uid:${userId}`;
  if (userEmail) return `${prefix}:email:${userEmail}`;

  const h = headers();
  const ipRaw =
    h.get("x-forwarded-for") ||
    h.get("x-real-ip") ||
    h.get("cf-connecting-ip") ||
    "unknown";
  const ip = ipRaw.split(",")[0].trim();

  return `${prefix}:ip:${ip}`;
}
