// Subscribe to giveaway.publish: build embed + post to channel + persist
// messageId so /announce can edit later.

import type { Client, TextChannel, NewsChannel } from "discord.js";
import { ChannelType } from "discord.js";
import {
  CHANNELS,
  decodeEvent,
  type GiveawayPublishPayload,
} from "@recodex/shared";
import { appPrisma } from "@recodex/db-app";
import { pointsPrisma } from "@recodex/db-points";
import { sub } from "../redis.js";
import { logger } from "../logger.js";
import { buildGiveawayEmbed } from "../embed.js";

export function registerPublishHandler(client: Client): void {
  sub.on("message", async (channel: string, raw: string) => {
    if (channel !== CHANNELS.GIVEAWAY_PUBLISH) return;
    let payload: GiveawayPublishPayload;
    try {
      payload = decodeEvent(CHANNELS.GIVEAWAY_PUBLISH, raw);
    } catch (err) {
      logger.warn({ err }, "publish payload decode failed");
      return;
    }
    await handlePublish(client, payload);
  });
}

async function handlePublish(client: Client, payload: GiveawayPublishPayload): Promise<void> {
  const giveaway = await appPrisma.giveaway.findUnique({ where: { id: payload.giveawayId } });
  if (!giveaway) {
    logger.warn({ giveawayId: payload.giveawayId }, "publish: giveaway not found");
    return;
  }

  const branding = await pointsPrisma.brandingConfig.findUnique({
    where: { guildId: giveaway.guildId },
  });

  const ch = await client.channels.fetch(payload.channelId).catch(() => null);
  if (
    !ch ||
    (ch.type !== ChannelType.GuildText && ch.type !== ChannelType.GuildAnnouncement)
  ) {
    logger.warn({ channelId: payload.channelId }, "publish: channel not text-like");
    return;
  }

  const built = await buildGiveawayEmbed(giveaway, branding);
  const sent = await (ch as TextChannel | NewsChannel).send({
    embeds: [built.embed],
    components: built.components,
    files: built.files,
  });

  await appPrisma.giveaway.update({
    where: { id: giveaway.id },
    data: { messageId: sent.id, channelId: ch.id },
  });

  await appPrisma.log.create({
    data: {
      guildId: giveaway.guildId,
      level: "EVENT",
      source: "RX.Giveaway",
      event: "giveaway.published",
      message: `Posted "${giveaway.title}" to <#${ch.id}>`,
      meta: { giveawayId: giveaway.id, messageId: sent.id },
    },
  });

  logger.info(
    { giveawayId: giveaway.id, channelId: ch.id, messageId: sent.id },
    "giveaway published",
  );
}
