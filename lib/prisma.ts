// lib/prisma.ts
import { PrismaClient } from "@prisma/client";

// Extend the global type to cache PrismaClient in dev
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

// Reuse cached client if it exists (important for Next.js dev hot reloads)
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

// Cache the client in dev, but not in production
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
