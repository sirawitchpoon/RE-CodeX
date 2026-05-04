// Build the LIVE Giveaway embed posted to Discord. Branding labels go through
// renderLabel so renaming "Signals"/"EXP" only requires updating
// BrandingConfig — never code.

import { promises as fs } from "node:fs";
import path from "node:path";
import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
} from "discord.js";
import {
  type Branding,
  DEFAULT_BRANDING,
  parseAccentColor,
} from "@recodex/shared";
import { env } from "./env.js";

export interface GiveawayForEmbed {
  id: string;
  title: string;
  prize: string;
  coverPath: string | null;
  winnersCount: number;
  endsAt: Date | null;
}

export interface EmbedBuild {
  embed: EmbedBuilder;
  components: ActionRowBuilder<ButtonBuilder>[];
  files: AttachmentBuilder[];
}

export async function buildGiveawayEmbed(
  giveaway: GiveawayForEmbed,
  branding: Branding | null,
): Promise<EmbedBuild> {
  const b = branding ?? DEFAULT_BRANDING;
  const color = parseAccentColor(b.accentColor);

  // Minimal embed: Title + Reward (description) + 2 inline fields
  // (Ends + จำนวนผู้ที่ได้รับรางวัล). Helper text stays out — the
  // button labels "เข้าร่วม" / "แก้ไขข้อมูล" are self-explanatory.
  const embed = new EmbedBuilder()
    .setColor(color)
    .setAuthor({ name: "NEW GIVEAWAY" })
    .setTitle(`${b.currencyEmoji} ${giveaway.title}`)
    .setDescription(`**Reward:** ${giveaway.prize}`)
    .addFields(
      {
        name: "Ends",
        value: giveaway.endsAt
          ? `<t:${Math.floor(giveaway.endsAt.getTime() / 1000)}:R>`
          : "—",
        inline: true,
      },
      {
        name: "จำนวนผู้ที่ได้รับรางวัล",
        value: `${giveaway.winnersCount} คน`,
        inline: true,
      },
    )
    .setFooter({ text: "Re:CodeX · Giveaway" })
    .setTimestamp();

  const files: AttachmentBuilder[] = [];
  if (giveaway.coverPath) {
    const filename = path.basename(giveaway.coverPath);
    const abs = path.join(env.UPLOADS_DIR, "giveaways", filename);
    try {
      await fs.access(abs);
      const att = new AttachmentBuilder(abs, { name: filename });
      files.push(att);
      embed.setImage(`attachment://${filename}`);
    } catch {
      // cover file missing — skip image rather than error
    }
  }

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`gw:join:${giveaway.id}`)
      .setLabel("เข้าร่วม")
      .setStyle(ButtonStyle.Primary)
      .setEmoji(b.currencyEmoji),
    new ButtonBuilder()
      .setCustomId(`gw:edit:${giveaway.id}`)
      .setLabel("แก้ไขข้อมูล")
      .setStyle(ButtonStyle.Secondary),
  );

  return { embed, components: [row], files };
}
