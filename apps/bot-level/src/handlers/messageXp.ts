// messageCreate handler. Filters: not-bot, length >= textMinChars, channel
// not in excludedChannels. Per-(guild,user,channel) Redis cooldown via
// SETEX NX. XP rolled in [textMin..textMax].

import type { Client, Message } from "discord.js";
import { ChannelType } from "discord.js";
import { pointsPrisma } from "@recodex/db-points";
import { loadConfig } from "../configCache.js";
import { tryCooldown } from "../redis.js";
import { grantXp, applyLevelUp } from "../grant.js";
import { logger } from "../logger.js";
import { bumpEvent } from "../heartbeat.js";

function rollInRange(min: number, max: number): number {
  if (max <= min) return Math.max(0, min);
  return min + Math.floor(Math.random() * (max - min + 1));
}

export function registerMessageXp(client: Client): void {
  client.on("messageCreate", async (msg: Message) => {
    if (msg.author.bot || msg.system) return;
    if (!msg.guildId) return;
    if (msg.channel.type !== ChannelType.GuildText && msg.channel.type !== ChannelType.GuildVoice) {
      return;
    }

    const { cfg, rewards } = await loadConfig(msg.guildId);
    if (!cfg.textEnabled) return;
    if (msg.content.length < cfg.textMinChars) return;
    if (cfg.excludedChannels.includes(msg.channelId)) return;

    const cooldownKey = `cool:text:${msg.guildId}:${msg.author.id}:${msg.channelId}`;
    if (!(await tryCooldown(cooldownKey, cfg.textCooldownSec))) return;

    const amount = rollInRange(cfg.textMin, cfg.textMax);
    if (amount <= 0) return;

    // Mirror user (cheap upsert; helps cross-DB joins for leaderboard render)
    await pointsPrisma.user
      .upsert({
        where: { id: msg.author.id },
        update: {
          username: msg.author.username,
          displayName: msg.author.globalName ?? null,
          avatarHash: msg.author.avatar ?? null,
        },
        create: {
          id: msg.author.id,
          username: msg.author.username,
          displayName: msg.author.globalName ?? null,
          avatarHash: msg.author.avatar ?? null,
        },
      })
      .catch(() => null);

    try {
      const result = await grantXp(
        {
          guildId: msg.guildId,
          userId: msg.author.id,
          source: "TEXT",
          amount,
          channelId: msg.channelId,
          messageId: msg.id,
        },
        cfg,
      );
      bumpEvent();
      if (result.leveledUp) {
        await applyLevelUp(msg.guild, {
          guildId: msg.guildId,
          userId: msg.author.id,
          source: "TEXT",
          amount,
          channelId: msg.channelId,
          messageId: msg.id,
        }, result, rewards);
      }
    } catch (err) {
      logger.warn({ err, userId: msg.author.id }, "text XP grant failed");
    }
  });
}
