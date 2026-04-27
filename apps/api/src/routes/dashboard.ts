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

const BOT_UI: Record<string, { icon: string; iconBg: string; color: string }> = {
  "bot-level":    { icon: "trophy", iconBg: "linear-gradient(135deg,#7ae0ff,#4a90e2)", color: "#7ae0ff" },
  "bot-giveaway": { icon: "gift",   iconBg: "linear-gradient(135deg,#c77dff,#7b2cbf)", color: "#c77dff" },
};

function formatUptime(startedAt: Date): string {
  const sec = Math.floor((Date.now() - startedAt.getTime()) / 1000);
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  return `${d}d ${String(h).padStart(2, "0")}h`;
}

function mapBot(b: {
  id: string; name: string; status: string; version: string;
  startedAt: Date; cpuPct: number | null; memMb: number | null; eventCount: bigint;
}) {
  const ui = BOT_UI[b.id] ?? { icon: "zap", iconBg: "linear-gradient(135deg,#6fe39a,#3a8060)", color: "#6fe39a" };
  return {
    ...ui,
    id: b.id,
    name: b.name,
    status: b.status,
    version: b.version,
    uptime: formatUptime(b.startedAt),
    cpu: b.cpuPct ?? 0,
    mem: b.memMb != null ? `${b.memMb} MB` : "—",
    events: Number(b.eventCount),
    spark: [] as number[],
    lastCmd: "—",
    lastSubject: "—",
    lastWhen: "—",
  };
}

dashboardRouter.get("/dashboard/bots", async (_req, res) => {
  const bots = await appPrisma.botInstance.findMany({ orderBy: { name: "asc" } });
  res.json(bots.map(mapBot));
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
      bots: bots.map(mapBot),
    }),
  );
});
