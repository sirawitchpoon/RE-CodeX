import { Redis } from "ioredis";
import { env } from "./env.js";
import { logger } from "./logger.js";

function build(name: string): Redis {
  const c = new Redis(env.REDIS_URL, { lazyConnect: false, maxRetriesPerRequest: 3 });
  c.on("connect", () => logger.info({ redis: name }, "redis connected"));
  c.on("error", (err) => logger.error({ redis: name, err: err.message }, "redis error"));
  return c;
}

export const pub: Redis = build("pub");
export const sub: Redis = build("sub");

export async function disconnect(): Promise<void> {
  await Promise.allSettled([pub.quit(), sub.quit()]);
}
