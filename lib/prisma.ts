// lib/prisma.ts
import { PrismaClient } from "@prisma/client";

/**
 * Runtime (serverless) should use the POOLED connection string (DATABASE_URL).
 * Migrations will use the DIRECT connection (DATABASE_DIRECT_URL) via
 * prisma/schema.prisma's `directUrl` — no code changes needed here.
 *
 * Make sure DATABASE_URL includes:
 *   &pgbouncer=true&connection_limit=1
 * …and that both DB URLs share the same current password.
 */

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

// Use pooled URL for all app/runtime Prisma usage
const datasourceUrl = process.env.DATABASE_URL;

if (!datasourceUrl) {
  throw new Error("Missing DATABASE_URL in environment variables.");
}

export const prisma =
  global.__prisma ??
  new PrismaClient({
    // Prisma 5+ preferred override for connection string
    datasourceUrl,
    log: process.env.NODE_ENV === "development" ? ["query", "warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.__prisma = prisma;
}
