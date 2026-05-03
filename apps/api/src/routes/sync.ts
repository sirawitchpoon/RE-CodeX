// Sheets sync observability endpoints.
// Backoffice polls these to render a status pill on the Giveaway page so the
// admin can spot a stuck Apps Script (full quota, wrong URL, etc.) before
// missing real entries.

import { Router } from "express";
import { appPrisma } from "@recodex/db-app";
import { env } from "../env.js";

export const syncRouter = Router();

// Cap recent rows shown to keep the response small even after a long outage.
const RECENT_LIMIT = 20;

syncRouter.get("/giveaway/sync-status", async (_req, res) => {
  const [pending, dead, syncedToday, recent] = await Promise.all([
    appPrisma.entrySyncOutbox.count({ where: { status: "PENDING" } }),
    appPrisma.entrySyncOutbox.count({ where: { status: "DEAD" } }),
    appPrisma.entrySyncOutbox.count({
      where: {
        status: "SYNCED",
        syncedAt: { gte: new Date(Date.now() - 24 * 60 * 60_000) },
      },
    }),
    appPrisma.entrySyncOutbox.findMany({
      orderBy: { createdAt: "desc" },
      take: RECENT_LIMIT,
      select: {
        id: true,
        type: true,
        status: true,
        attempts: true,
        lastError: true,
        nextAttemptAt: true,
        syncedAt: true,
        createdAt: true,
      },
    }),
  ]);

  res.json({
    enabled: Boolean(env.SHEETS_WEBHOOK_URL && env.SHEETS_WEBHOOK_TOKEN),
    counts: { pending, dead, syncedLast24h: syncedToday },
    recent,
  });
});

// Manual retry — flip DEAD rows back to PENDING (single id or all).
// Useful after fixing the Apps Script script or refreshing the deploy URL.
syncRouter.post("/giveaway/sync-status/retry", async (req, res) => {
  const id = typeof req.body?.id === "string" ? req.body.id : null;
  const where = id ? { id, status: "DEAD" as const } : { status: "DEAD" as const };
  const result = await appPrisma.entrySyncOutbox.updateMany({
    where,
    data: { status: "PENDING", attempts: 0, nextAttemptAt: new Date(), lastError: null },
  });
  res.json({ requeued: result.count });
});
