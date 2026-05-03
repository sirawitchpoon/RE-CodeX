// Per-guild TTL cache of GiveawayMember rows. The API publishes
// `giveaway.members.changed` on CRUD — `invalidate` clears that guild so the
// next pickmain ephemeral renders the fresh list. Otherwise entries live for
// `TTL_MS` (60s) so a busy interaction path doesn't hit DB on every click.

import { pointsPrisma, type GiveawayMember } from "@recodex/db-points";

const TTL_MS = 60_000;

interface Entry {
  members: GiveawayMember[];
  expiresAt: number;
}

const cache = new Map<string, Entry>();

export async function loadMembers(guildId: string): Promise<GiveawayMember[]> {
  const now = Date.now();
  const hit = cache.get(guildId);
  if (hit && hit.expiresAt > now) return hit.members;

  const members = await pointsPrisma.giveawayMember.findMany({
    where: { guildId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  cache.set(guildId, { members, expiresAt: now + TTL_MS });
  return members;
}

export function invalidate(guildId: string): void {
  cache.delete(guildId);
}

export async function findMember(
  guildId: string,
  memberId: string,
): Promise<GiveawayMember | null> {
  const list = await loadMembers(guildId);
  const hit = list.find((m) => m.id === memberId);
  if (hit) return hit;
  // Cold miss: maybe the cache is stale and a member was just added.
  invalidate(guildId);
  const fresh = await loadMembers(guildId);
  return fresh.find((m) => m.id === memberId) ?? null;
}
