// GiveawayMember CRUD — per-guild cast members for the main-pick flow.
// Lives in points-db. Mutations publish `giveaway.members.changed` so the
// bot's TTL cache invalidates without polling. DELETE blocks if any UserMain
// row references the member.

import { Router } from "express";
import { z } from "zod";
import { pointsPrisma } from "@recodex/db-points";
import { CHANNELS, encodeEvent } from "@recodex/shared";
import { pub } from "../redis.js";

export const membersRouter = Router();

const memberCreateSchema = z.object({
  name: z.string().min(1).max(40),
  roleId: z.string().min(1).max(40),
  sortOrder: z.number().int().min(0).max(1000).optional(),
  accentColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional()
    .nullable(),
  emoji: z.string().min(1).max(40).optional().nullable(),
});

const memberUpdateSchema = memberCreateSchema.partial();

async function publishChanged(guildId: string): Promise<void> {
  await pub.publish(
    CHANNELS.MEMBERS_CHANGED,
    encodeEvent(CHANNELS.MEMBERS_CHANGED, { guildId }),
  );
}

membersRouter.get("/giveaway/:guildId/members", async (req, res) => {
  const rows = await pointsPrisma.giveawayMember.findMany({
    where: { guildId: req.params.guildId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  res.json(rows);
});

membersRouter.post("/giveaway/:guildId/members", async (req, res) => {
  const parsed = memberCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_payload", issues: parsed.error.issues });
    return;
  }
  try {
    const created = await pointsPrisma.giveawayMember.create({
      data: {
        guildId: req.params.guildId,
        name: parsed.data.name,
        roleId: parsed.data.roleId,
        sortOrder: parsed.data.sortOrder ?? 0,
        accentColor: parsed.data.accentColor ?? null,
        emoji: parsed.data.emoji ?? null,
      },
    });
    await publishChanged(req.params.guildId);
    res.status(201).json(created);
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") {
      res.status(409).json({ error: "duplicate_name_or_role" });
      return;
    }
    throw err;
  }
});

membersRouter.put("/giveaway/:guildId/members/:id", async (req, res) => {
  const parsed = memberUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_payload", issues: parsed.error.issues });
    return;
  }
  try {
    const updated = await pointsPrisma.giveawayMember.update({
      where: { id: req.params.id },
      data: {
        ...(parsed.data.name !== undefined && { name: parsed.data.name }),
        ...(parsed.data.roleId !== undefined && { roleId: parsed.data.roleId }),
        ...(parsed.data.sortOrder !== undefined && { sortOrder: parsed.data.sortOrder }),
        ...(parsed.data.accentColor !== undefined && {
          accentColor: parsed.data.accentColor,
        }),
        ...(parsed.data.emoji !== undefined && { emoji: parsed.data.emoji }),
      },
    });
    await publishChanged(req.params.guildId);
    res.json(updated);
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "P2025") {
      res.status(404).json({ error: "not_found" });
      return;
    }
    if (code === "P2002") {
      res.status(409).json({ error: "duplicate_name_or_role" });
      return;
    }
    throw err;
  }
});

membersRouter.delete("/giveaway/:guildId/members/:id", async (req, res) => {
  const usedBy = await pointsPrisma.userMain.count({
    where: { memberId: req.params.id },
  });
  if (usedBy > 0) {
    res.status(409).json({ error: "in_use", count: usedBy });
    return;
  }
  try {
    await pointsPrisma.giveawayMember.delete({ where: { id: req.params.id } });
    await publishChanged(req.params.guildId);
    res.status(204).end();
  } catch (err) {
    if ((err as { code?: string }).code === "P2025") {
      res.status(404).json({ error: "not_found" });
      return;
    }
    throw err;
  }
});
