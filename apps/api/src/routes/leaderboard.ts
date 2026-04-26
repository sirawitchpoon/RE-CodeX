// GET /api/leaderboard?guildId=&range=day|week|month|all&limit=50
//
// Returns ranked users; the frontend joins this against /users/:id (or its
// own member cache) for display name / avatar.

import { Router } from "express";
import { z } from "zod";
import { leaderboard, type LeaderboardRange } from "../services/leaderboardQuery.js";

export const leaderboardRouter = Router();

const querySchema = z.object({
  guildId: z.string().min(1),
  range: z.enum(["day", "week", "month", "all"]).default("all"),
  limit: z.coerce.number().int().min(1).max(500).default(50),
});

leaderboardRouter.get("/leaderboard", async (req, res) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_query", issues: parsed.error.issues });
    return;
  }
  const rows = await leaderboard(
    parsed.data.guildId,
    parsed.data.range as LeaderboardRange,
    parsed.data.limit,
  );
  res.json({ range: parsed.data.range, rows });
});
