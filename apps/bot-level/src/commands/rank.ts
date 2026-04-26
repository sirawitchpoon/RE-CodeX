// /rank [user] — show level + XP progress as an Embed. Branding labels are
// rendered via @recodex/shared so renaming "Signals"/"EXP" doesn't touch
// this file.

import {
  type ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";
import { pointsPrisma } from "@recodex/db-points";
import {
  DEFAULT_BRANDING,
  parseAccentColor,
  progressToNext,
  renderLabel,
} from "@recodex/shared";
import { loadConfig } from "../configCache.js";

export const rankCommand = new SlashCommandBuilder()
  .setName("rank")
  .setDescription("ดูเลเวล + XP ของคุณหรือคนอื่น")
  .addUserOption((o) =>
    o.setName("user").setDescription("ผู้ใช้ที่จะดู (ค่าเริ่มต้น = ตัวคุณ)").setRequired(false),
  );

function progressBar(pct: number, width = 20): string {
  const filled = Math.round(Math.min(1, Math.max(0, pct)) * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
}

export async function executeRank(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guildId) {
    await interaction.reply({ ephemeral: true, content: "❌ ใช้ได้ในเซิร์ฟเวอร์เท่านั้น" });
    return;
  }
  const target = interaction.options.getUser("user") ?? interaction.user;

  const [{ cfg }, total, branding] = await Promise.all([
    loadConfig(interaction.guildId),
    pointsPrisma.xpTotal.findUnique({
      where: { guildId_userId: { guildId: interaction.guildId, userId: target.id } },
    }),
    pointsPrisma.brandingConfig.findUnique({ where: { guildId: interaction.guildId } }),
  ]);

  const b = branding ?? DEFAULT_BRANDING;
  const xp = total?.totalXp ?? 0n;
  const progress = progressToNext(xp, cfg);

  // Compute server rank
  const above = await pointsPrisma.xpTotal.count({
    where: { guildId: interaction.guildId, totalXp: { gt: xp } },
  });
  const rank = above + 1;

  const embed = new EmbedBuilder()
    .setColor(parseAccentColor(b.accentColor))
    .setTitle(`${b.currencyEmoji} ${target.globalName ?? target.username}`)
    .setThumbnail(target.displayAvatarURL({ size: 128 }))
    .addFields(
      { name: "Rank", value: `#${rank}`, inline: true },
      { name: "Level", value: `Lv.${progress.level}`, inline: true },
      { name: b.xpLabel, value: `${xp.toString()} / ${(BigInt(progress.xpInto) + BigInt(progress.xpToNext) + BigInt(xp.toString()) - BigInt(progress.xpInto)).toString()}`, inline: true },
      {
        name: "Progress",
        value: `\`${progressBar(progress.pct)}\` ${(progress.pct * 100).toFixed(1)}%`,
        inline: false,
      },
    )
    .setFooter({ text: renderLabel("Re:CodeX · {signals}", b) });

  await interaction.reply({ embeds: [embed] });
}
