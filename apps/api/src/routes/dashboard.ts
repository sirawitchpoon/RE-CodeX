// Dashboard aggregations.
//
// /api/dashboard/stats?guildId=  → { activeBots, totalEvents24h, members,
//   bots: BotInstance[] }
// /api/dashboard/bots            → BotInstance[]
//
// Live updates flow through SSE (bot.heartbeat); this endpoint is the
// initial fill on page load.

import { Router } from "express";
import { appPrisma } from "@recodex/db-app";
import { pointsPrisma } from "@recodex/db-points";

export const dashboardRouter = Router();

function bigintSafe<T>(v: T): T {
  return JSON.parse(
    JSON.stringify(v, (_k, val) => (typeof val === "bigint" ? val.toString() : val)),
  ) as T;
}

dashboardRouter.get("/dashboard/bots", async (_req, res) => {
  const bots = await appPrisma.botInstance.findMany({ orderBy: { name: "asc" } });
  res.json(bigintSafe(bots));
});

dashboardRouter.get("/dashboard/stats", async (req, res) => {
  const guildId = typeof req.query.guildId === "string" ? req.query.guildId : undefined;
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);

  const [bots, events24h, totalMembers] = await Promise.all([
    appPrisma.botInstance.findMany({ orderBy: { name: "asc" } }),
    pointsPrisma.xpEvent.count({
      where: {
        createdAt: { gte: dayAgo },
        ...(guildId ? { guildId } : {}),
      },
    }),
    guildId
      ? pointsPrisma.xpTotal.count({ where: { guildId } })
      : pointsPrisma.user.count(),
  ]);

  const activeBots = bots.filter((b) => b.lastHeartbeat >= fiveMinAgo).length;

  res.json(
    bigintSafe({
      activeBots,
      totalBots: bots.length,
      totalEvents24h: events24h,
      totalMembers,
      bots,
    }),
  );
});
