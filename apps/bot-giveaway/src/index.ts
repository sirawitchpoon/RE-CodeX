// bot-giveaway entrypoint.
//
// Subscribes to two Redis channels (publish/announce) — both posted by the
// API. Listens for two interaction kinds (button click / modal submit). All
// DB writes go through the shared Prisma clients.

import { Client, GatewayIntentBits, Partials } from "discord.js";
import { CHANNELS } from "@recodex/shared";
import { env } from "./env.js";
import { logger } from "./logger.js";
import { sub, disconnect as disconnectRedis } from "./redis.js";
import { appPrisma } from "@recodex/db-app";
import { pointsPrisma } from "@recodex/db-points";
import { registerPublishHandler } from "./handlers/publish.js";
import { registerButtonHandler } from "./handlers/button.js";
import { registerModalHandler } from "./handlers/modal.js";
import { registerAnnounceHandler } from "./handlers/announce.js";
import { startHeartbeat, stopHeartbeat } from "./heartbeat.js";

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
  partials: [Partials.Channel],
});

client.once("ready", (c) => {
  logger.info({ tag: c.user.tag, guildId: env.GUILD_ID }, "bot-giveaway ready");
  startHeartbeat(client);
});

registerPublishHandler(client);
registerButtonHandler(client);
registerModalHandler(client);
registerAnnounceHandler(client);

async function boot(): Promise<void> {
  await sub.subscribe(CHANNELS.GIVEAWAY_PUBLISH, CHANNELS.GIVEAWAY_ANNOUNCE);
  await client.login(env.GIVEAWAY_BOT_TOKEN);
}

boot().catch((err) => {
  logger.fatal({ err }, "bot-giveaway boot failed");
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
