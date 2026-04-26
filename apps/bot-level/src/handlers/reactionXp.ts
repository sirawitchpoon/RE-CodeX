// Reaction XP. Awards XP to the MESSAGE AUTHOR (not the reactor) — matches
// the LevelRules.jsx mock copy ("XP per reaction received"). Per-(message,
// reactor) Redis cooldown so alts can't farm by spamming reactions.
//
// Self-reactions (author === reactor) are ignored.

import type { Client, MessageReaction, User, PartialMessageReaction, PartialUser } from "discord.js";
import { loadConfig } from "../configCache.js";
import { tryCooldown } from "../redis.js";
import { grantXp, applyLevelUp } from "../grant.js";
import { logger } from "../logger.js";
import { bumpEvent } from "../heartbeat.js";

export function registerReactionXp(client: Client): void {
  client.on(
    "messageReactionAdd",
    async (reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) => {
      try {
        const reactor = user.partial ? await user.fetch() : user;
        if (reactor.bot) return;
        const r = reaction.partial ? await reaction.fetch() : reaction;
        const msg = r.message.partial ? await r.message.fetch() : r.message;
        if (!msg.guildId) return;
        if (msg.author.bot) return;
        if (msg.author.id === reactor.id) return;

        const { cfg, rewards } = await loadConfig(msg.guildId);
        if (!cfg.reactionEnabled || cfg.reactionAmount <= 0) return;

        const cooldownKey = `cool:react:${msg.id}:${reactor.id}`;
        if (!(await tryCooldown(cooldownKey, 60 * 60 * 24))) return; // 1/day per (msg, reactor)

        const result = await grantXp(
          {
            guildId: msg.guildId,
            userId: msg.author.id,
            source: "REACTION",
            amount: cfg.reactionAmount,
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
            source: "REACTION",
            amount: cfg.reactionAmount,
            channelId: msg.channelId,
            messageId: msg.id,
          }, result, rewards);
        }
      } catch (err) {
        logger.warn({ err }, "reaction XP grant failed");
      }
    },
  );
}
