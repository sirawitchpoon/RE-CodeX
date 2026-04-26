// app-db Prisma client (Giveaway, GiveawayEntry, Log, BotInstance).
// Custom output path keeps it isolated from db-points's client.

import { PrismaClient } from ".prisma/app-client";

declare global {
  // eslint-disable-next-line no-var
  var __recodexAppPrisma: PrismaClient | undefined;
}

export const appPrisma: PrismaClient =
  global.__recodexAppPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "production" ? ["error"] : ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.__recodexAppPrisma = appPrisma;
}

export * from ".prisma/app-client";
