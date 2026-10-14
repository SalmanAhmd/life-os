import { PrismaClient } from "@prisma/client";

import { getServerEnv } from "@/lib/env";

/**
 * Prisma client singleton.
 *
 * In development Next.js hot-reloads modules, which would otherwise create a
 * new connection pool on every reload. We cache the client on `globalThis`.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  getServerEnv(); // fail fast if the environment is misconfigured
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const db: PrismaClient = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
