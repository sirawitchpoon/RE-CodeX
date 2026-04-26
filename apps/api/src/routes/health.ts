// GET /api/health — pings both Postgres containers + Redis. Returns 200 if
// any single dependency is down so caller can see *which* one — but `ok`
// flag is the AND. Smoke test #3 of the handoff plan asserts this shape:
//   { ok: true, db: true, redis: true } — extended here to surface the
//   two-DB split.

import { Router } from "express";
import { pointsPrisma } from "@recodex/db-points";
import { appPrisma } from "@recodex/db-app";
import { pingRedis } from "../redis.js";
import { logger } from "../logger.js";

export const healthRouter = Router();

healthRouter.get("/health", async (_req, res) => {
  const [pointsDb, appDb, redis] = await Promise.all([
    pointsPrisma
      .$queryRaw`SELECT 1`.then(() => true)
      .catch((err: unknown) => {
        logger.warn({ err }, "points-db ping failed");
        return false;
      }),
    appPrisma
      .$queryRaw`SELECT 1`.then(() => true)
      .catch((err: unknown) => {
        logger.warn({ err }, "app-db ping failed");
        return false;
      }),
    pingRedis(),
  ]);

  res.json({
    ok: pointsDb && appDb && redis,
    pointsDb,
    appDb,
    redis,
    ts: new Date().toISOString(),
  });
});
