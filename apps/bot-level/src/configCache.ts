// In-memory TTL cache of LevelConfig + RoleReward[] per guild. The API
// publishes `level.config.changed` on PUT — `invalidate` clears that guild
// (the next read goes to points-db). Otherwise entries live for `TTL_MS`
// (60s by default) so a busy `messageCreate` hot path doesn't hit DB on
// every grant.

import { pointsPrisma, type LevelConfig, type RoleReward } from "@recodex/db-points";

const TTL_MS = 60_000;

interface Entry {
  cfg: LevelConfig;
  rewards: RoleReward[];
  expiresAt: number;
}

const cache = new Map<string, Entry>();

export async function loadConfig(guildId: string): Promise<Entry> {
  const now = Date.now();
  const hit = cache.get(guildId);
  if (hit && hit.expiresAt > now) return hit;

  let cfg = await pointsPrisma.levelConfig.findUnique({ where: { guildId } });
  if (!cfg) {
    // Auto-bootstrap if a guild becomes active before being seeded
    cfg = await pointsPrisma.levelConfig.upsert({
      where: { guildId },
      update: {},
      create: { guildId },
    });
  }
  const rewards = await pointsPrisma.roleReward.findMany({
    where: { guildId },
    orderBy: { level: "asc" },
  });
  const entry: Entry = { cfg, rewards, expiresAt: now + TTL_MS };
  cache.set(guildId, entry);
  return entry;
}

export function invalidate(guildId: string): void {
  cache.delete(guildId);
}
