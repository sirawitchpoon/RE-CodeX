import { Redis } from "ioredis";
import { env } from "./env.js";
import { logger } from "./logger.js";

function build(name: string): Redis {
  const c = new Redis(env.REDIS_URL, { lazyConnect: false, maxRetriesPerRequest: 3 });
  c.on("connect", () => logger.info({ redis: name }, "redis connected"));
  c.on("error", (err) => logger.error({ redis: name, err: err.message }, "redis error"));
  return c;
}

// `pub` doubles as the cooldown SETEX/NX client.
export const pub: Redis = build("pub");
export const sub: Redis = build("sub");

export async function disconnect(): Promise<void> {
  await Promise.allSettled([pub.quit(), sub.quit()]);
}

/**
 * Acquire a per-cooldown-key lock for `ttlSec` seconds. Returns true on
 * acquisition. Used for: text-XP cooldown per (guild, user, channel),
 * reaction-XP dedupe per (message, reactor).
 */
export async function tryCooldown(key: string, ttlSec: number): Promise<boolean> {
  const reply = await pub.set(key, "1", "EX", ttlSec, "NX");
  return reply === "OK";
}
