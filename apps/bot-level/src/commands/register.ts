// Guild-scoped command registration. Run on bot boot. Guild scope = instant
// availability (vs ~1h for global). Single-guild MVP per user spec.

import { REST, Routes } from "discord.js";
import { env } from "../env.js";
import { logger } from "../logger.js";
import { rankCommand } from "./rank.js";
import { leaderboardCommand } from "./leaderboard.js";

export async function registerSlashCommands(): Promise<void> {
  const rest = new REST({ version: "10" }).setToken(env.LEVEL_BOT_TOKEN);
  const body = [rankCommand.toJSON(), leaderboardCommand.toJSON()];
  try {
    await rest.put(
      Routes.applicationGuildCommands(env.LEVEL_BOT_APP_ID, env.GUILD_ID),
      { body },
    );
    logger.info({ count: body.length, guildId: env.GUILD_ID }, "slash commands registered");
  } catch (err) {
    logger.error({ err }, "slash command register failed");
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  registerSlashCommands().then(() => process.exit(0));
}
