// Route incoming slash interactions to the right command handler.

import type { Client, Interaction } from "discord.js";
import { executeRank } from "../commands/rank.js";
import { executeLeaderboard } from "../commands/leaderboard.js";
import { logger } from "../logger.js";

export function registerSlashRouter(client: Client): void {
  client.on("interactionCreate", async (interaction: Interaction) => {
    if (!interaction.isChatInputCommand()) return;
    try {
      switch (interaction.commandName) {
        case "rank":
          await executeRank(interaction);
          break;
        case "leaderboard":
          await executeLeaderboard(interaction);
          break;
        default:
          await interaction.reply({ ephemeral: true, content: "❌ คำสั่งไม่รู้จัก" });
      }
    } catch (err) {
      logger.error({ err, cmd: interaction.commandName }, "slash handler error");
      if (!interaction.replied && !interaction.deferred) {
        await interaction
          .reply({ ephemeral: true, content: "❌ เกิดข้อผิดพลาด" })
          .catch(() => null);
      }
    }
  });
}
