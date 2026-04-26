// Leaderboard queries.
//
// `range=all` reads the denormalized XpTotal table (O(1) per row, indexed by
// totalXp DESC). Other ranges aggregate XpEvent rows over the time window
// and join back to XpTotal for the user's current level/role.

import { pointsPrisma } from "@recodex/db-points";

export type LeaderboardRange = "day" | "week" | "month" | "all";

export interface LeaderboardRow {
  userId: string;
  totalXp: string; // BigInt as string for JSON
  level: number;
  rangeGain: string; // BigInt as string
}

const WINDOW_MS: Record<Exclude<LeaderboardRange, "all">, number> = {
  day: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
};

export async function leaderboard(
  guildId: string,
  range: LeaderboardRange,
  limit: number,
): Promise<LeaderboardRow[]> {
  if (range === "all") {
    const rows = await pointsPrisma.xpTotal.findMany({
      where: { guildId },
      orderBy: { totalXp: "desc" },
      take: limit,
      select: { userId: true, totalXp: true, level: true },
    });
    return rows.map((r) => ({
      userId: r.userId,
      totalXp: r.totalXp.toString(),
      level: r.level,
      rangeGain: r.totalXp.toString(),
    }));
  }

  const since = new Date(Date.now() - WINDOW_MS[range]);
  const grouped = await pointsPrisma.xpEvent.groupBy({
    by: ["userId"],
    where: { guildId, createdAt: { gte: since } },
    _sum: { amount: true },
    orderBy: { _sum: { amount: "desc" } },
    take: limit,
  });

  if (grouped.length === 0) return [];

  const userIds = grouped.map((g) => g.userId);
  const totals = await pointsPrisma.xpTotal.findMany({
    where: { guildId, userId: { in: userIds } },
    select: { userId: true, totalXp: true, level: true },
  });
  const totalsMap = new Map(totals.map((t) => [t.userId, t]));

  return grouped.map((g) => {
    const t = totalsMap.get(g.userId);
    return {
      userId: g.userId,
      totalXp: (t?.totalXp ?? 0n).toString(),
      level: t?.level ?? 0,
      rangeGain: BigInt(g._sum.amount ?? 0).toString(),
    };
  });
}
