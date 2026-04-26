import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __recodexPrisma: PrismaClient | undefined;
}

export const prisma: PrismaClient =
  global.__recodexPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "production" ? ["error"] : ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.__recodexPrisma = prisma;
}

export * from "@prisma/client";
