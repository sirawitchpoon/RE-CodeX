// bot-level entrypoint.

import { Client, GatewayIntentBits, Partials } from "discord.js";
import { CHANNELS } from "@recodex/shared";
import { env } from "./env.js";
import { logger } from "./logger.js";
import { sub, disconnect as disconnectRedis } from "./redis.js";
import { appPrisma } from "@recodex/db-app";
import { pointsPrisma } from "@recodex/db-points";
import { registerMessageXp } from "./handlers/messageXp.js";
import { registerVoiceXp } from "./handlers/voiceXp.js";
import { registerReactionXp } from "./handlers/reactionXp.js";
import { registerConfigChange } from "./handlers/configChange.js";
import { registerSlashRouter } from "./handlers/slash.js";
import { registerSlashCommands } from "./commands/register.js";
import { startHeartbeat, stopHeartbeat } from "./heartbeat.js";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

client.once("ready", async (c) => {
  logger.info({ tag: c.user.tag, guildId: env.GUILD_ID }, "bot-level ready");
  await registerSlashCommands();
  startHeartbeat(client);
});

registerMessageXp(client);
registerVoiceXp(client);
registerReactionXp(client);
registerSlashRouter(client);
registerConfigChange();

async function boot(): Promise<void> {
  await sub.subscribe(CHANNELS.LEVEL_CONFIG_CHANGED);
  await client.login(env.LEVEL_BOT_TOKEN);
}

boot().catch((err) => {
  logger.fatal({ err }, "bot-level boot failed");
  process.exit(1);
});

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "shutting down");
  stopHeartbeat();
  try {
    await client.destroy();
  } catch {
    /* ignore */
  }
  await Promise.allSettled([
    disconnectRedis(),
    appPrisma.$disconnect(),
    pointsPrisma.$disconnect(),
  ]);
  process.exit(0);
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
