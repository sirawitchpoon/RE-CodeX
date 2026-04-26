// Subscribe to level.config.changed → invalidate the per-guild TTL cache so
// the next XP grant uses the fresh config.

import {
  CHANNELS,
  decodeEvent,
  type LevelConfigChangedPayload,
} from "@recodex/shared";
import { sub } from "../redis.js";
import { invalidate } from "../configCache.js";
import { logger } from "../logger.js";

export function registerConfigChange(): void {
  sub.on("message", (channel: string, raw: string) => {
    if (channel !== CHANNELS.LEVEL_CONFIG_CHANGED) return;
    try {
      const payload: LevelConfigChangedPayload = decodeEvent(
        CHANNELS.LEVEL_CONFIG_CHANGED,
        raw,
      );
      invalidate(payload.guildId);
      logger.info({ guildId: payload.guildId }, "level config cache invalidated");
    } catch (err) {
      logger.warn({ err }, "config change decode failed");
    }
  });
}
