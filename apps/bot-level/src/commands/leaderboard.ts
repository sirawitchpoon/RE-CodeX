// /leaderboard — top 10 by all-time XP. Reads denormalized XpTotal so the
// query is O(N) on a sorted index.

import {
  type ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";
import { pointsPrisma } from "@recodex/db-points";
import { DEFAULT_BRANDING, parseAccentColor, renderLabel } from "@recodex/shared";

export const leaderboardCommand = new SlashCommandBuilder()
  .setName("leaderboard")
  .setDescription("ดูอันดับ Top 10 ของเซิร์ฟเวอร์");

const MEDAL = ["🥇", "🥈", "🥉"];

export async function executeLeaderboard(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guildId) {
    await interaction.reply({ ephemeral: true, content: "❌ ใช้ได้ในเซิร์ฟเวอร์เท่านั้น" });
    return;
  }

  const [rows, branding] = await Promise.all([
    pointsPrisma.xpTotal.findMany({
      where: { guildId: interaction.guildId },
      orderBy: { totalXp: "desc" },
      take: 10,
    }),
    pointsPrisma.brandingConfig.findUnique({ where: { guildId: interaction.guildId } }),
  ]);
  const b = branding ?? DEFAULT_BRANDING;

  if (rows.length === 0) {
    await interaction.reply({ ephemeral: true, content: "ยังไม่มี XP ในเซิร์ฟเวอร์นี้" });
    return;
  }

  const userIds = rows.map((r) => r.userId);
  const users = await pointsPrisma.user.findMany({ where: { id: { in: userIds } } });
  const usersMap = new Map(users.map((u) => [u.id, u]));

  const lines = rows.map((r, i) => {
    const u = usersMap.get(r.userId);
    const name = u?.displayName ?? u?.username ?? `<@${r.userId}>`;
    const medal = MEDAL[i] ?? `**${i + 1}.**`;
    return `${medal} ${name} — Lv.${r.level} · ${r.totalXp.toString()} ${b.xpLabel}`;
  });

  const embed = new EmbedBuilder()
    .setColor(parseAccentColor(b.accentColor))
    .setTitle(renderLabel("{emoji} Leaderboard — Top {signals}", b).replace("{signals}", "10"))
    .setDescription(lines.join("\n"))
    .setFooter({ text: renderLabel("Re:CodeX · {signals}", b) });

  await interaction.reply({ embeds: [embed] });
}
