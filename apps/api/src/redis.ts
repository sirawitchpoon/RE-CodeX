// Two ioredis connections: one for publish + regular commands, one dedicated
// to subscribe (ioredis enters subscriber mode and refuses other commands on
// a connection once it has SUBSCRIBE'd anything). Both share REDIS_URL.

import { Redis } from "ioredis";
import { env } from "./env.js";
import { logger } from "./logger.js";

function build(name: string): Redis {
  const client = new Redis(env.REDIS_URL, {
    lazyConnect: false,
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
  });
  client.on("connect", () => logger.info({ redis: name }, "redis connected"));
  client.on("error", (err: Error) =>
    logger.error({ redis: name, err: err.message }, "redis error"),
  );
  return client;
}

export const pub: Redis = build("pub");
export const sub: Redis = build("sub");

export async function pingRedis(): Promise<boolean> {
  try {
    const reply = await pub.ping();
    return reply === "PONG";
  } catch {
    return false;
  }
}

export async function disconnectRedis(): Promise<void> {
  await Promise.allSettled([pub.quit(), sub.quit()]);
}
