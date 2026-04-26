// GET /api/logs?level=&before=cursor&limit=200 — paginated read of the Log
// table. The live tail comes from the SSE /api/events/logs stream; this is
// just for initial fill and back-scroll.

import { Router } from "express";
import { z } from "zod";
import { appPrisma, LogLevel } from "@recodex/db-app";

export const logsRouter = Router();

const querySchema = z.object({
  level: z.enum(["INFO", "WARN", "ERROR", "EVENT"]).optional(),
  guildId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
  before: z.coerce.bigint().optional(),
});

logsRouter.get("/logs", async (req, res) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_query", issues: parsed.error.issues });
    return;
  }
  const where: {
    level?: LogLevel;
    guildId?: string;
    id?: { lt: bigint };
  } = {};
  if (parsed.data.level) where.level = parsed.data.level as LogLevel;
  if (parsed.data.guildId) where.guildId = parsed.data.guildId;
  if (parsed.data.before) where.id = { lt: parsed.data.before };

  const rows = await appPrisma.log.findMany({
    where,
    orderBy: { id: "desc" },
    take: parsed.data.limit,
  });

  res.json(
    JSON.parse(
      JSON.stringify(rows, (_k, v) => (typeof v === "bigint" ? v.toString() : v)),
    ),
  );
});
