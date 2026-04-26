// voiceStateUpdate handler. Strategy:
//   - join (oldChannelId == null, newChannelId != null) → set XpTotal.voiceJoinedAt = now
//   - leave/move (newChannelId != oldChannelId) → compute minutes, grant XP,
//     reset voiceJoinedAt to "now" if still in another channel, else null
//
// Stage channels (ChannelType.GuildStageVoice) get cfg.stageMultiplier.

import type { Client, VoiceState } from "discord.js";
import { ChannelType } from "discord.js";
import { pointsPrisma } from "@recodex/db-points";
import { loadConfig } from "../configCache.js";
import { grantXp, applyLevelUp } from "../grant.js";
import { logger } from "../logger.js";
import { bumpEvent } from "../heartbeat.js";

export function registerVoiceXp(client: Client): void {
  client.on("voiceStateUpdate", async (oldState: VoiceState, newState: VoiceState) => {
    if (!newState.guild?.id) return;
    const userId = newState.id;
    const guildId = newState.guild.id;
    if (newState.member?.user?.bot) return;

    const wasIn = oldState.channelId;
    const nowIn = newState.channelId;
    if (wasIn === nowIn) return;

    const { cfg, rewards } = await loadConfig(guildId);
    if (!cfg.voiceEnabled) return;

    // case 1: join from nowhere → mark voiceJoinedAt
    if (!wasIn && nowIn) {
      await pointsPrisma.xpTotal.upsert({
        where: { guildId_userId: { guildId, userId } },
        update: { voiceJoinedAt: new Date() },
        create: { guildId, userId, voiceJoinedAt: new Date() },
      }).catch(() => null);
      return;
    }

    // case 2: leave or move → grant for the time since voiceJoinedAt
    const total = await pointsPrisma.xpTotal.findUnique({
      where: { guildId_userId: { guildId, userId } },
    });
    if (!total?.voiceJoinedAt) {
      // restart-recovery: first event after a crash; just reset to now/null
      await pointsPrisma.xpTotal.update({
        where: { guildId_userId: { guildId, userId } },
        data: { voiceJoinedAt: nowIn ? new Date() : null },
      }).catch(() => null);
      return;
    }

    const minutes = Math.max(
      0,
      Math.floor((Date.now() - total.voiceJoinedAt.getTime()) / 60_000),
    );
    let source: "VOICE" | "STAGE" = "VOICE";
    let amount = minutes * cfg.voicePerMinute;
    if (oldState.channel?.type === ChannelType.GuildStageVoice) {
      amount = amount * cfg.stageMultiplier;
      source = "STAGE";
    }

    // Update voiceJoinedAt regardless of whether we award XP
    await pointsPrisma.xpTotal.update({
      where: { guildId_userId: { guildId, userId } },
      data: { voiceJoinedAt: nowIn ? new Date() : null },
    }).catch(() => null);

    if (amount <= 0) return;

    try {
      const result = await grantXp(
        {
          guildId,
          userId,
          source,
          amount,
          channelId: oldState.channelId,
        },
        cfg,
      );
      bumpEvent();
      if (result.leveledUp) {
        await applyLevelUp(newState.guild, {
          guildId,
          userId,
          source,
          amount,
          channelId: oldState.channelId,
        }, result, rewards);
      }
    } catch (err) {
      logger.warn({ err, userId }, "voice XP grant failed");
    }
  });

  // Restart recovery: clear stale voiceJoinedAt at boot so a crash doesn't
  // grant unbounded XP on the next leave event.
  client.once("ready", async () => {
    try {
      await pointsPrisma.xpTotal.updateMany({
        where: { voiceJoinedAt: { not: null } },
        data: { voiceJoinedAt: null },
      });
    } catch {
      /* ignore */
    }
  });
}
