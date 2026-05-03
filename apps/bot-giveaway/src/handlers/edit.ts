// Subscribe to giveaway.edit: re-render the embed for the giveaway and edit
// the existing Discord message in place. Triggered by API PATCH on a LIVE
// giveaway, and by the /end endpoint to flip the join button to disabled.

import type { Client, TextChannel, NewsChannel } from "discord.js";
import {
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import {
  CHANNELS,
  decodeEvent,
  type GiveawayEditPayload,
} from "@recodex/shared";
import { appPrisma } from "@recodex/db-app";
import { pointsPrisma } from "@recodex/db-points";
import { sub } from "../redis.js";
import { logger } from "../logger.js";
import { buildGiveawayEmbed } from "../embed.js";

export function registerEditHandler(client: Client): void {
  sub.on("message", async (channel: string, raw: string) => {
    if (channel !== CHANNELS.GIVEAWAY_EDIT) return;
    let payload: GiveawayEditPayload;
    try {
      payload = decodeEvent(CHANNELS.GIVEAWAY_EDIT, raw);
    } catch (err) {
      logger.warn({ err }, "edit payload decode failed");
      return;
    }
    await handleEdit(client, payload);
  });
}

async function handleEdit(client: Client, payload: GiveawayEditPayload): Promise<void> {
  const giveaway = await appPrisma.giveaway.findUnique({ where: { id: payload.giveawayId } });
  if (!giveaway || !giveaway.messageId) return;

  const ch = await client.channels.fetch(giveaway.channelId).catch(() => null);
  if (
    !ch ||
    (ch.type !== ChannelType.GuildText && ch.type !== ChannelType.GuildAnnouncement)
  ) {
    logger.warn({ giveawayId: giveaway.id }, "edit: channel not text-like");
    return;
  }

  const msg = await (ch as TextChannel | NewsChannel).messages
    .fetch(giveaway.messageId)
    .catch(() => null);
  if (!msg) {
    logger.warn({ giveawayId: giveaway.id }, "edit: message not found");
    return;
  }

  const branding = await pointsPrisma.brandingConfig.findUnique({
    where: { guildId: giveaway.guildId },
  });

  const built = await buildGiveawayEmbed(giveaway, branding);

  // If the giveaway is no longer LIVE (ended), disable both buttons so
  // people can still see the post but can't interact.
  const components =
    giveaway.status === "LIVE"
      ? built.components
      : [
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(`gw:join:${giveaway.id}`)
              .setLabel(giveaway.status === "ENDED" ? "Giveaway สิ้นสุดแล้ว" : "เข้าร่วม")
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(true),
            new ButtonBuilder()
              .setCustomId(`gw:edit:${giveaway.id}`)
              .setLabel("แก้ไขข้อมูล")
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(true),
          ),
        ];

  try {
    await msg.edit({
      embeds: [built.embed],
      components,
      files: built.files,
      attachments: [],
    });
  } catch (err) {
    logger.error({ err, giveawayId: giveaway.id }, "edit message failed");
  }
}
