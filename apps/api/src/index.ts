// Re:CodeX API entrypoint. Boot order:
//   1. env (fail-fast)
//   2. Express app + global middleware
//   3. Mount routes
//   4. Subscribe Redis channels → fan out via SSE hub
//   5. Start HTTP listener + SSE heartbeat
//   6. Wire SIGTERM/SIGINT for graceful shutdown

import express from "express";
import cors from "cors";
import { pinoHttp } from "pino-http";
import { CHANNELS, type ChannelName } from "@recodex/shared";
import { pointsPrisma } from "@recodex/db-points";
import { appPrisma } from "@recodex/db-app";
import { env } from "./env.js";
import { logger } from "./logger.js";
import { sub, disconnectRedis } from "./redis.js";
import { hub } from "./sse.js";
import path from "node:path";
import { auth } from "./middleware/auth.js";
import { healthRouter } from "./routes/health.js";
import { eventsRouter } from "./routes/events.js";
import { giveawaysRouter } from "./routes/giveaways.js";
import { levelsRouter } from "./routes/levels.js";
import { leaderboardRouter } from "./routes/leaderboard.js";
import { usersRouter } from "./routes/users.js";
import { logsRouter } from "./routes/logs.js";
import { dashboardRouter } from "./routes/dashboard.js";

const app = express();

app.use(cors({ origin: env.CORS_ORIGIN }));
app.use(express.json({ limit: "1mb" }));
app.use(
  pinoHttp({
    logger,
    // SSE endpoints are long-lived; logging completion adds noise
    autoLogging: {
      ignore: (req: { url?: string }) =>
        req.url?.startsWith("/api/events/") ?? false,
    },
  }),
);

// Static uploads served BEFORE auth — public read for cover images is fine
// (they're already shown inside Discord embeds via the same URL). When auth
// is added, /uploads can stay public or move behind auth as a separate call.
app.use(
  "/uploads",
  express.static(path.resolve(env.UPLOADS_DIR), {
    fallthrough: false,
    maxAge: "7d",
  }),
);

app.use("/api", auth);
app.use("/api", healthRouter);
app.use("/api", eventsRouter);
app.use("/api", giveawaysRouter);
app.use("/api", levelsRouter);
app.use("/api", leaderboardRouter);
app.use("/api", usersRouter);
app.use("/api", logsRouter);
app.use("/api", dashboardRouter);

app.use((_req, res) => {
  res.status(404).json({ error: "not_found" });
});

// ─── Redis fan-out ──────────────────────────────────────────────────────────
// Subscribe to every channel @recodex/shared declares; the hub decides which
// SSE topics receive each one. This keeps subscription wiring in one place.

const ALL_CHANNELS = Object.values(CHANNELS) as ChannelName[];

async function startRedisFanout(): Promise<void> {
  await sub.subscribe(...ALL_CHANNELS);
  sub.on("message", (channel: string, raw: string) => {
    hub.broadcastFromRedis(channel as ChannelName, raw);
  });
  logger.info({ channels: ALL_CHANNELS }, "subscribed to redis channels");
}

// ─── Boot ───────────────────────────────────────────────────────────────────

const server = app.listen(env.API_PORT, () => {
  logger.info(
    { port: env.API_PORT, env: env.NODE_ENV },
    "api listening",
  );
});

hub.startHeartbeat(15000);

startRedisFanout().catch((err) => {
  logger.error({ err }, "redis fan-out failed to start");
  process.exit(1);
});

// ─── Shutdown ───────────────────────────────────────────────────────────────

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "shutting down");

  hub.stopHeartbeat();
  hub.closeAll();

  await new Promise<void>((resolve) => server.close(() => resolve()));

  await Promise.allSettled([
    disconnectRedis(),
    pointsPrisma.$disconnect(),
    appPrisma.$disconnect(),
  ]);

  logger.info("shutdown complete");
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
