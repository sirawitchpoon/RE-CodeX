// LevelConfig + RoleReward CRUD. Both live in points-db.
//
// Mutations to LevelConfig publish `level.config.changed` so bot-level can
// invalidate its TTL cache without polling.

import { Router } from "express";
import { z } from "zod";
import { pointsPrisma } from "@recodex/db-points";
import { CHANNELS, encodeEvent } from "@recodex/shared";
import { pub } from "../redis.js";

export const levelsRouter = Router();

const configUpdateSchema = z.object({
  textEnabled: z.boolean().optional(),
  textMin: z.number().int().min(0).optional(),
  textMax: z.number().int().min(0).optional(),
  textCooldownSec: z.number().int().min(0).max(86400).optional(),
  textMinChars: z.number().int().min(0).optional(),
  excludedChannels: z.array(z.string()).optional(),
  voiceEnabled: z.boolean().optional(),
  voicePerMinute: z.number().int().min(0).optional(),
  reactionEnabled: z.boolean().optional(),
  reactionAmount: z.number().int().min(0).optional(),
  stageMultiplier: z.number().int().min(1).optional(),
  streakEnabled: z.boolean().optional(),
  streakBonus: z.number().int().min(0).optional(),
  curveLinear: z.number().int().min(1).optional(),
  curveQuadratic: z.number().int().min(0).optional(),
});

levelsRouter.get("/level/:guildId/config", async (req, res) => {
  const cfg = await pointsPrisma.levelConfig.findUnique({
    where: { guildId: req.params.guildId },
  });
  if (!cfg) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  res.json(cfg);
});

levelsRouter.put("/level/:guildId/config", async (req, res) => {
  const parsed = configUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_payload", issues: parsed.error.issues });
    return;
  }
  const guildId = req.params.guildId;

  const cfg = await pointsPrisma.levelConfig.upsert({
    where: { guildId },
    update: parsed.data,
    create: { guildId, ...parsed.data },
  });

  await pub.publish(
    CHANNELS.LEVEL_CONFIG_CHANGED,
    encodeEvent(CHANNELS.LEVEL_CONFIG_CHANGED, { guildId }),
  );

  res.json(cfg);
});

const roleRewardSchema = z.object({
  level: z.number().int().min(1),
  roleId: z.string().min(1),
  hint: z.string().optional().nullable(),
});

levelsRouter.get("/level/:guildId/role-rewards", async (req, res) => {
  const rewards = await pointsPrisma.roleReward.findMany({
    where: { guildId: req.params.guildId },
    orderBy: { level: "asc" },
  });
  res.json(rewards);
});

levelsRouter.post("/level/:guildId/role-rewards", async (req, res) => {
  const parsed = roleRewardSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_payload", issues: parsed.error.issues });
    return;
  }
  const reward = await pointsPrisma.roleReward.upsert({
    where: { guildId_level: { guildId: req.params.guildId, level: parsed.data.level } },
    update: { roleId: parsed.data.roleId, hint: parsed.data.hint ?? null },
    create: {
      guildId: req.params.guildId,
      level: parsed.data.level,
      roleId: parsed.data.roleId,
      hint: parsed.data.hint ?? null,
    },
  });
  res.status(201).json(reward);
});

levelsRouter.delete("/level/:guildId/role-rewards/:id", async (req, res) => {
  await pointsPrisma.roleReward
    .delete({ where: { id: req.params.id } })
    .catch(() => null);
  res.status(204).end();
});

// ─── Reset XP ──────────────────────────────────────────────────────────────
//
// Wipes XpEvent + XpTotal for a guild. Used before launch to clear test data
// without rebuilding the DB. Caller must POST { confirm: "reset" } so a stray
// curl can't nuke production by accident.

const resetSchema = z.object({ confirm: z.literal("reset") });

levelsRouter.post("/level/:guildId/xp-reset", async (req, res) => {
  const parsed = resetSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "missing_confirm" });
    return;
  }
  const guildId = req.params.guildId;
  const [events, totals] = await pointsPrisma.$transaction([
    pointsPrisma.xpEvent.deleteMany({ where: { guildId } }),
    pointsPrisma.xpTotal.deleteMany({ where: { guildId } }),
  ]);
  res.json({ ok: true, deletedEvents: events.count, deletedTotals: totals.count });
});

// ─── Branding (renamable labels) ───────────────────────────────────────────

const brandingSchema = z.object({
  signalsLabel: z.string().min(1).max(40).optional(),
  xpLabel: z.string().min(1).max(20).optional(),
  currencyEmoji: z.string().min(1).max(8).optional(),
  accentColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
});

levelsRouter.get("/branding/:guildId", async (req, res) => {
  const b = await pointsPrisma.brandingConfig.findUnique({
    where: { guildId: req.params.guildId },
  });
  if (!b) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  res.json(b);
});

levelsRouter.put("/branding/:guildId", async (req, res) => {
  const parsed = brandingSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_payload", issues: parsed.error.issues });
    return;
  }
  const b = await pointsPrisma.brandingConfig.upsert({
    where: { guildId: req.params.guildId },
    update: parsed.data,
    create: { guildId: req.params.guildId, ...parsed.data },
  });
  res.json(b);
});
