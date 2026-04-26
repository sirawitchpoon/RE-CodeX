// User profile + heatmap + top channels.
//
// GET /api/users/:guildId/:userId
//   - returns User + XpTotal merged
//   - ?heatmap=84  → adds 84-day daily counts (matches UserProfile.jsx mock)
//   - ?topChannels=5 → adds aggregated channels by message count
//
// Manual XP grant: POST /api/users/:guildId/:userId/xp { amount, source? }

import { Router } from "express";
import { z } from "zod";
import { pointsPrisma, XpSource } from "@recodex/db-points";
import { CHANNELS, encodeEvent, levelForXp, progressToNext } from "@recodex/shared";
import { pub } from "../redis.js";

export const usersRouter = Router();

const querySchema = z.object({
  heatmap: z.coerce.number().int().min(1).max(365).optional(),
  topChannels: z.coerce.number().int().min(1).max(20).optional(),
});

function bigintToString<T>(v: T): T {
  return JSON.parse(
    JSON.stringify(v, (_k, val) => (typeof val === "bigint" ? val.toString() : val)),
  ) as T;
}

usersRouter.get("/users/:guildId/:userId", async (req, res) => {
  const parsedQ = querySchema.safeParse(req.query);
  if (!parsedQ.success) {
    res.status(400).json({ error: "invalid_query", issues: parsedQ.error.issues });
    return;
  }
  const { guildId, userId } = req.params;

  const [user, total, cfg] = await Promise.all([
    pointsPrisma.user.findUnique({ where: { id: userId } }),
    pointsPrisma.xpTotal.findUnique({ where: { guildId_userId: { guildId, userId } } }),
    pointsPrisma.levelConfig.findUnique({ where: { guildId } }),
  ]);

  if (!user) {
    res.status(404).json({ error: "not_found" });
    return;
  }

  const curve = cfg ?? { curveLinear: 1000, curveQuadratic: 250 };
  const totalXp = total?.totalXp ?? 0n;
  const progress = progressToNext(totalXp, curve);

  let heatmap: { date: string; count: number }[] | undefined;
  if (parsedQ.data.heatmap) {
    const days = parsedQ.data.heatmap;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const rows = await pointsPrisma.$queryRaw<
      { day: Date; n: bigint }[]
    >`SELECT DATE_TRUNC('day', "createdAt") AS day, COUNT(*) AS n
      FROM "XpEvent"
      WHERE "guildId" = ${guildId} AND "userId" = ${userId} AND "createdAt" >= ${since}
      GROUP BY 1 ORDER BY 1`;
    heatmap = rows.map((r) => ({
      date: r.day.toISOString().slice(0, 10),
      count: Number(r.n),
    }));
  }

  let topChannels: { channelId: string; count: number }[] | undefined;
  if (parsedQ.data.topChannels) {
    const limit = parsedQ.data.topChannels;
    const grouped = await pointsPrisma.xpEvent.groupBy({
      by: ["channelId"],
      where: { guildId, userId, source: XpSource.TEXT, channelId: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { channelId: "desc" } },
      take: limit,
    });
    topChannels = grouped.map((g) => ({
      channelId: g.channelId ?? "",
      count: g._count._all,
    }));
  }

  res.json(
    bigintToString({
      user,
      total: total ?? null,
      level: progress.level,
      xp: totalXp.toString(),
      xpInto: progress.xpInto,
      xpToNext: progress.xpToNext,
      pct: progress.pct,
      heatmap,
      topChannels,
    }),
  );
});

const grantSchema = z.object({
  amount: z.number().int().min(-100000).max(100000),
  source: z.enum(["TEXT", "VOICE", "REACTION", "STAGE", "STREAK", "MANUAL"]).default("MANUAL"),
});

usersRouter.post("/users/:guildId/:userId/xp", async (req, res) => {
  const parsed = grantSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_payload", issues: parsed.error.issues });
    return;
  }
  const { guildId, userId } = req.params;

  const cfg = await pointsPrisma.levelConfig.findUnique({ where: { guildId } });
  const curve = cfg ?? { curveLinear: 1000, curveQuadratic: 250 };

  // ensure user exists (manual grants from backoffice may target unseen users)
  await pointsPrisma.user.upsert({
    where: { id: userId },
    update: {},
    create: { id: userId, username: userId },
  });

  const result = await pointsPrisma.$transaction(async (tx) => {
    await tx.xpEvent.create({
      data: {
        guildId,
        userId,
        source: parsed.data.source as XpSource,
        amount: parsed.data.amount,
      },
    });
    const updated = await tx.xpTotal.upsert({
      where: { guildId_userId: { guildId, userId } },
      update: {
        totalXp: { increment: parsed.data.amount },
        lastGrantAt: new Date(),
      },
      create: {
        guildId,
        userId,
        totalXp: parsed.data.amount,
        level: 0,
        lastGrantAt: new Date(),
      },
    });
    const newLevel = levelForXp(updated.totalXp, curve);
    if (newLevel !== updated.level) {
      await tx.xpTotal.update({
        where: { guildId_userId: { guildId, userId } },
        data: { level: newLevel },
      });
    }
    return { totalXp: updated.totalXp, oldLevel: updated.level, newLevel };
  });

  if (result.newLevel !== result.oldLevel) {
    await pub.publish(
      CHANNELS.LEVEL_UP,
      encodeEvent(CHANNELS.LEVEL_UP, {
        guildId,
        userId,
        oldLevel: result.oldLevel,
        newLevel: result.newLevel,
        totalXp: result.totalXp.toString(),
      }),
    );
  }

  res.json(
    bigintToString({
      totalXp: result.totalXp,
      oldLevel: result.oldLevel,
      newLevel: result.newLevel,
    }),
  );
});

// list members (basic — for Members.jsx future wiring)
usersRouter.get("/members/:guildId", async (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 200), 1000);
  const totals = await pointsPrisma.xpTotal.findMany({
    where: { guildId: req.params.guildId },
    orderBy: { totalXp: "desc" },
    take: limit,
  });
  const userIds = totals.map((t) => t.userId);
  const users = await pointsPrisma.user.findMany({ where: { id: { in: userIds } } });
  const usersMap = new Map(users.map((u) => [u.id, u]));
  res.json(
    bigintToString(
      totals.map((t) => ({
        ...t,
        user: usersMap.get(t.userId) ?? null,
      })),
    ),
  );
});
