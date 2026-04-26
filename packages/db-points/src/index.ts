// points-db Prisma client (Guild, User, BrandingConfig, LevelConfig,
// RoleReward, XpEvent, XpTotal). Custom output path keeps it isolated from
// db-app's client.

import { PrismaClient } from ".prisma/points-client";

declare global {
  // eslint-disable-next-line no-var
  var __recodexPointsPrisma: PrismaClient | undefined;
}

export const pointsPrisma: PrismaClient =
  global.__recodexPointsPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "production" ? ["error"] : ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.__recodexPointsPrisma = pointsPrisma;
}

export * from ".prisma/points-client";
