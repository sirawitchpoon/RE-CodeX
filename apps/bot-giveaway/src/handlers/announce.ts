// Subscribe to giveaway.announce: reply in the original channel mentioning
// each winner. Looks up the original message via Giveaway.messageId so the
// reply is threaded under the embed.

import type { Client, TextChannel, NewsChannel } from "discord.js";
import { ChannelType } from "discord.js";
import {
  CHANNELS,
  decodeEvent,
  type GiveawayAnnouncePayload,
} from "@recodex/shared";
import { appPrisma } from "@recodex/db-app";
import { sub } from "../redis.js";
import { logger } from "../logger.js";

export function registerAnnounceHandler(client: Client): void {
  sub.on("message", async (channel: string, raw: string) => {
    if (channel !== CHANNELS.GIVEAWAY_ANNOUNCE) return;
    let payload: GiveawayAnnouncePayload;
    try {
      payload = decodeEvent(CHANNELS.GIVEAWAY_ANNOUNCE, raw);
    } catch (err) {
      logger.warn({ err }, "announce payload decode failed");
      return;
    }
    await handleAnnounce(client, payload);
  });
}

async function handleAnnounce(client: Client, payload: GiveawayAnnouncePayload): Promise<void> {
  const giveaway = await appPrisma.giveaway.findUnique({ where: { id: payload.giveawayId } });
  if (!giveaway) return;

  const ch = await client.channels.fetch(giveaway.channelId).catch(() => null);
  if (
    !ch ||
    (ch.type !== ChannelType.GuildText && ch.type !== ChannelType.GuildAnnouncement)
  ) {
    logger.warn({ giveawayId: giveaway.id }, "announce: channel not text-like");
    return;
  }

  const mentions = payload.winnerUserIds.map((id) => `<@${id}>`).join(" ");
  const body = `🎉 **Giveaway: ${giveaway.title}** ปิดรอบแล้ว!\nผู้โชคดี: ${mentions}\nรางวัล: ${giveaway.prize}`;

  try {
    if (giveaway.messageId) {
      const msg = await (ch as TextChannel | NewsChannel).messages
        .fetch(giveaway.messageId)
        .catch(() => null);
      if (msg) {
        await msg.reply({ content: body, allowedMentions: { users: payload.winnerUserIds } });
        return;
      }
    }
    await (ch as TextChannel | NewsChannel).send({
      content: body,
      allowedMentions: { users: payload.winnerUserIds },
    });
  } catch (err) {
    logger.error({ err, giveawayId: giveaway.id }, "announce send failed");
  }
}
