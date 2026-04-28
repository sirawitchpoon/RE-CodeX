// Subscribe to giveaway.cancel: edit the original Discord post to show that
// the giveaway has been cancelled and disable the join button.

import type { Client, TextChannel, NewsChannel } from "discord.js";
import {
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";
import {
  CHANNELS,
  decodeEvent,
  parseAccentColor,
  DEFAULT_BRANDING,
  type GiveawayCancelPayload,
} from "@recodex/shared";
import { appPrisma } from "@recodex/db-app";
import { pointsPrisma } from "@recodex/db-points";
import { sub } from "../redis.js";
import { logger } from "../logger.js";

export function registerCancelHandler(client: Client): void {
  sub.on("message", async (channel: string, raw: string) => {
    if (channel !== CHANNELS.GIVEAWAY_CANCEL) return;
    let payload: GiveawayCancelPayload;
    try {
      payload = decodeEvent(CHANNELS.GIVEAWAY_CANCEL, raw);
    } catch (err) {
      logger.warn({ err }, "cancel payload decode failed");
      return;
    }
    await handleCancel(client, payload);
  });
}

async function handleCancel(client: Client, payload: GiveawayCancelPayload): Promise<void> {
  const giveaway = await appPrisma.giveaway.findUnique({ where: { id: payload.giveawayId } });
  if (!giveaway || !giveaway.messageId) return;

  const ch = await client.channels.fetch(giveaway.channelId).catch(() => null);
  if (
    !ch ||
    (ch.type !== ChannelType.GuildText && ch.type !== ChannelType.GuildAnnouncement)
  ) {
    logger.warn({ giveawayId: giveaway.id }, "cancel: channel not text-like");
    return;
  }

  const msg = await (ch as TextChannel | NewsChannel).messages
    .fetch(giveaway.messageId)
    .catch(() => null);
  if (!msg) {
    logger.warn({ giveawayId: giveaway.id }, "cancel: message not found");
    return;
  }

  const branding = await pointsPrisma.brandingConfig.findUnique({
    where: { guildId: giveaway.guildId },
  });
  const b = branding ?? DEFAULT_BRANDING;
  const color = parseAccentColor(b.accentColor);

  const cancelled = new EmbedBuilder()
    .setColor(color)
    .setAuthor({ name: "GIVEAWAY CANCELLED" })
    .setTitle(`~~${giveaway.title}~~`)
    .setDescription(
      [
        `**Prize:** ~~${giveaway.prize}~~`,
        "",
        "❌ Giveaway นี้ถูกยกเลิกแล้ว — ขออภัยในความไม่สะดวก",
      ].join("\n"),
    )
    .setFooter({ text: "Re:CodeX · Giveaway" })
    .setTimestamp();

  const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`gw:cancelled:${giveaway.id}`)
      .setLabel("ยกเลิกแล้ว")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
  );

  try {
    await msg.edit({ embeds: [cancelled], components: [disabledRow] });
  } catch (err) {
    logger.error({ err, giveawayId: giveaway.id }, "cancel edit failed");
  }
}
