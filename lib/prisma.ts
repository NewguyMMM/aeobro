// lib/prisma.ts
import { PrismaClient } from "@prisma/client";

/**
 * Prefer DIRECT connection for Prisma (Neon pooler can be flaky with Prisma).
 * Falls back to DATABASE_URL if DIRECT is not provided.
 */
const DATABASE_URL =
  process.env.DATABASE_DIRECT_URL || process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error(
    "Missing DATABASE_DIRECT_URL / DATABASE_URL in environment variables."
  );
}

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export const prisma =
  globalThis.prisma ??
  new PrismaClient({
    datasources: { db: { url: DATABASE_URL } },
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalThis.prisma = prisma;
