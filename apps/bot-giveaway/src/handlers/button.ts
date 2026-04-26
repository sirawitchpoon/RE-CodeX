// Button click → open Modal. Custom_id format: gw:join:<giveawayId>
//
// The 4 fields below match apps/web/src/pages/DiscordMockup.jsx exactly:
//   - displayName: required, max 32
//   - platform:    select Twitter|Bluesky|Pixiv (Discord modals don't have
//                  a true select, so use a short text input with hint)
//   - handle:      optional
//   - message:     paragraph, optional, max 300

import {
  type Client,
  type Interaction,
  ModalBuilder,
  ActionRowBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { logger } from "../logger.js";

export const JOIN_CUSTOM_ID_PREFIX = "gw:join:";
export const MODAL_CUSTOM_ID_PREFIX = "gw:entry:";

export function registerButtonHandler(client: Client): void {
  client.on("interactionCreate", async (interaction: Interaction) => {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith(JOIN_CUSTOM_ID_PREFIX)) return;
    const giveawayId = interaction.customId.slice(JOIN_CUSTOM_ID_PREFIX.length);

    const modal = new ModalBuilder()
      .setCustomId(`${MODAL_CUSTOM_ID_PREFIX}${giveawayId}`)
      .setTitle("เข้าร่วม Giveaway");

    const displayName = new TextInputBuilder()
      .setCustomId("displayName")
      .setLabel("ชื่อในวง / Display Name")
      .setStyle(TextInputStyle.Short)
      .setMaxLength(32)
      .setRequired(true);

    const platform = new TextInputBuilder()
      .setCustomId("platform")
      .setLabel("Platform หลัก (Twitter / Bluesky / Pixiv)")
      .setPlaceholder("Twitter")
      .setStyle(TextInputStyle.Short)
      .setMaxLength(20)
      .setRequired(true);

    const handle = new TextInputBuilder()
      .setCustomId("handle")
      .setLabel("Platform Handle")
      .setPlaceholder("@yourname")
      .setStyle(TextInputStyle.Short)
      .setMaxLength(64)
      .setRequired(false);

    const message = new TextInputBuilder()
      .setCustomId("message")
      .setLabel("ข้อความถึงเมมเบอร์")
      .setStyle(TextInputStyle.Paragraph)
      .setMaxLength(300)
      .setRequired(false);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(displayName),
      new ActionRowBuilder<TextInputBuilder>().addComponents(platform),
      new ActionRowBuilder<TextInputBuilder>().addComponents(handle),
      new ActionRowBuilder<TextInputBuilder>().addComponents(message),
    );

    try {
      await interaction.showModal(modal);
    } catch (err) {
      logger.warn({ err, giveawayId }, "showModal failed");
    }
  });
}
