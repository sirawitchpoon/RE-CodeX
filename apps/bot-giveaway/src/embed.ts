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
  renderLabel,
} from "@recodex/shared";
import { env } from "./env.js";

export interface GiveawayForEmbed {
  id: string;
  title: string;
  prize: string;
  description: string | null;
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

  const embed = new EmbedBuilder()
    .setColor(color)
    .setAuthor({ name: "NEW GIVEAWAY" })
    .setTitle(`${b.currencyEmoji} ${giveaway.title}`)
    .setDescription(
      [
        `**Prize:** ${giveaway.prize}`,
        giveaway.description ?? "",
        "",
        renderLabel(
          "กดปุ่ม **เข้าร่วม Giveaway** ด้านล่างแล้วกรอกข้อมูลใน modal — โชคดี {signals}!",
          b,
        ),
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .addFields(
      { name: "Winners", value: String(giveaway.winnersCount), inline: true },
      {
        name: "Ends",
        value: giveaway.endsAt
          ? `<t:${Math.floor(giveaway.endsAt.getTime() / 1000)}:R>`
          : "—",
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
      .setLabel("เข้าร่วม Giveaway")
      .setStyle(ButtonStyle.Primary)
      .setEmoji(b.currencyEmoji),
  );

  return { embed, components: [row], files };
}
