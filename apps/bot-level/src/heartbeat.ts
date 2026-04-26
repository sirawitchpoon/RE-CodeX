import { Client } from "discord.js";
import { appPrisma } from "@recodex/db-app";
import { CHANNELS, encodeEvent } from "@recodex/shared";
import { pub } from "./redis.js";

const BOT_ID = "bot-level";
const VERSION = "0.1.0";
const INTERVAL_MS = 30_000;

let timer: NodeJS.Timeout | null = null;
let eventCount = 0n;

export function bumpEvent(): void {
  eventCount += 1n;
}

export function startHeartbeat(client: Client): void {
  const beat = async () => {
    const mem = process.memoryUsage();
    const status = client.isReady() ? "ONLINE" : "IDLE";
    try {
      await appPrisma.botInstance.upsert({
        where: { id: BOT_ID },
        update: {
          status,
          version: VERSION,
          lastHeartbeat: new Date(),
          memMb: Math.round(mem.rss / 1024 / 1024),
          eventCount,
        },
        create: {
          id: BOT_ID,
          name: "Level",
          status,
          version: VERSION,
          memMb: Math.round(mem.rss / 1024 / 1024),
          eventCount,
        },
      });
      await pub.publish(
        CHANNELS.BOT_HEARTBEAT,
        encodeEvent(CHANNELS.BOT_HEARTBEAT, {
          id: BOT_ID,
          name: "Level",
          status,
          version: VERSION,
          memMb: Math.round(mem.rss / 1024 / 1024),
          eventCount: eventCount.toString(),
          at: new Date().toISOString(),
        }),
      );
    } catch {
      /* retry next tick */
    }
  };
  void beat();
  timer = setInterval(beat, INTERVAL_MS);
  timer.unref?.();
}

export function stopHeartbeat(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
