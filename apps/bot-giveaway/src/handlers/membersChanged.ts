// Subscribe to giveaway.members.changed → invalidate the per-guild member
// cache so the next pickmain ephemeral renders fresh data.

import {
  CHANNELS,
  decodeEvent,
  type MembersChangedPayload,
} from "@recodex/shared";
import { sub } from "../redis.js";
import { invalidate } from "../membersCache.js";
import { logger } from "../logger.js";

export function registerMembersChangedHandler(): void {
  sub.on("message", (channel: string, raw: string) => {
    if (channel !== CHANNELS.MEMBERS_CHANGED) return;
    try {
      const payload: MembersChangedPayload = decodeEvent(
        CHANNELS.MEMBERS_CHANGED,
        raw,
      );
      invalidate(payload.guildId);
      logger.info({ guildId: payload.guildId }, "members cache invalidated");
    } catch (err) {
      logger.warn({ err }, "members changed decode failed");
    }
  });
}
