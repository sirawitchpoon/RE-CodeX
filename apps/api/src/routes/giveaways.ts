// Giveaway routes.
//
// CRUD + image upload + lifecycle (publish / draw / announce). Image lives on
// the API's local volume at ${UPLOADS_DIR}/giveaways/<id>.<ext> and is served
// by the static handler mounted in src/index.ts as /uploads/*.
//
// publish/announce don't talk to Discord directly — they publish to Redis and
// the giveaway bot picks up the message. This keeps the API stateless w.r.t.
// Discord credentials.

import { Router } from "express";
import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { appPrisma, GiveawayStatus, GiveawayPlatform } from "@recodex/db-app";
import { CHANNELS, encodeEvent } from "@recodex/shared";
import { env } from "../env.js";
import { logger } from "../logger.js";
import { pub } from "../redis.js";
import { upload } from "../upload.js";
import { drawWinners } from "../services/giveawayDraw.js";

export const giveawaysRouter = Router();

// ─── helpers ───────────────────────────────────────────────────────────────

const MIME_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

function giveawayDir(): string {
  return path.join(env.UPLOADS_DIR, "giveaways");
}

async function ensureUploadDir(): Promise<void> {
  await fs.mkdir(giveawayDir(), { recursive: true });
}

async function writeCover(
  giveawayId: string,
  buf: Buffer,
  mime: string,
): Promise<string> {
  await ensureUploadDir();
  const ext = MIME_EXT[mime] ?? "bin";
  const filename = `${giveawayId}.${ext}`;
  await fs.writeFile(path.join(giveawayDir(), filename), buf);
  return `/uploads/giveaways/${filename}`;
}

async function deleteCoverIfAny(coverPath: string | null): Promise<void> {
  if (!coverPath) return;
  const filename = path.basename(coverPath);
  await fs.rm(path.join(giveawayDir(), filename), { force: true });
}

// JSON serialization helper — Prisma returns BigInt for entry ids; we stringify
function serializable<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v)),
  ) as T;
}

// ─── schemas ───────────────────────────────────────────────────────────────

const platformEnum = z.enum(["TWITTER", "BLUESKY", "PIXIV"]);
const statusEnum = z.enum(["DRAFT", "SCHEDULED", "LIVE", "ENDED"]);

const createSchema = z.object({
  guildId: z.string().min(1),
  channelId: z.string().min(1),
  title: z.string().min(1).max(120),
  prize: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  requiredRoleId: z.string().optional().nullable(),
  minLevel: z.coerce.number().int().min(0).default(0),
  winnersCount: z.coerce.number().int().min(1).max(100).default(1),
  status: statusEnum.optional(),
  startsAt: z.coerce.date().optional().nullable(),
  endsAt: z.coerce.date().optional().nullable(),
});

const updateSchema = createSchema.partial();

// multipart sends `data` as a JSON-encoded string field next to the `cover` file
function parseDataField(value: unknown): Record<string, unknown> {
  if (typeof value !== "string") return {};
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}

// ─── routes ────────────────────────────────────────────────────────────────

giveawaysRouter.get("/giveaways", async (req, res) => {
  const guildId = typeof req.query.guildId === "string" ? req.query.guildId : undefined;
  const list = await appPrisma.giveaway.findMany({
    where: guildId ? { guildId } : undefined,
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { entries: true } } },
  });
  res.json(serializable(list));
});

giveawaysRouter.get("/giveaways/:id", async (req, res) => {
  const giveaway = await appPrisma.giveaway.findUnique({
    where: { id: req.params.id },
    include: {
      entries: {
        orderBy: { createdAt: "desc" },
        take: 500,
      },
      _count: { select: { entries: true } },
    },
  });
  if (!giveaway) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  res.json(serializable(giveaway));
});

giveawaysRouter.post(
  "/giveaways",
  upload.single("cover"),
  async (req, res) => {
    const data = parseDataField(req.body?.data);
    const parsed = createSchema.safeParse(data);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_payload", issues: parsed.error.issues });
      return;
    }

    const created = await appPrisma.giveaway.create({
      data: {
        guildId: parsed.data.guildId,
        channelId: parsed.data.channelId,
        title: parsed.data.title,
        prize: parsed.data.prize,
        description: parsed.data.description ?? null,
        requiredRoleId: parsed.data.requiredRoleId ?? null,
        minLevel: parsed.data.minLevel,
        winnersCount: parsed.data.winnersCount,
        status: (parsed.data.status as GiveawayStatus | undefined) ?? "DRAFT",
        startsAt: parsed.data.startsAt ?? null,
        endsAt: parsed.data.endsAt ?? null,
      },
    });

    let coverPath: string | null = null;
    if (req.file) {
      try {
        coverPath = await writeCover(created.id, req.file.buffer, req.file.mimetype);
        await appPrisma.giveaway.update({
          where: { id: created.id },
          data: { coverPath },
        });
      } catch (err) {
        logger.error({ err, giveawayId: created.id }, "cover write failed");
      }
    }

    const final = await appPrisma.giveaway.findUnique({ where: { id: created.id } });
    res.status(201).json(serializable(final));
  },
);

giveawaysRouter.patch(
  "/giveaways/:id",
  upload.single("cover"),
  async (req, res) => {
    const existing = await appPrisma.giveaway.findUnique({
      where: { id: req.params.id },
    });
    if (!existing) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    const data = parseDataField(req.body?.data);
    const parsed = updateSchema.safeParse(data);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_payload", issues: parsed.error.issues });
      return;
    }

    let coverPath: string | undefined;
    if (req.file) {
      await deleteCoverIfAny(existing.coverPath);
      coverPath = await writeCover(existing.id, req.file.buffer, req.file.mimetype);
    }

    const updated = await appPrisma.giveaway.update({
      where: { id: existing.id },
      data: {
        ...(parsed.data.title !== undefined && { title: parsed.data.title }),
        ...(parsed.data.prize !== undefined && { prize: parsed.data.prize }),
        ...(parsed.data.description !== undefined && {
          description: parsed.data.description,
        }),
        ...(parsed.data.channelId !== undefined && { channelId: parsed.data.channelId }),
        ...(parsed.data.requiredRoleId !== undefined && {
          requiredRoleId: parsed.data.requiredRoleId,
        }),
        ...(parsed.data.minLevel !== undefined && { minLevel: parsed.data.minLevel }),
        ...(parsed.data.winnersCount !== undefined && {
          winnersCount: parsed.data.winnersCount,
        }),
        ...(parsed.data.status !== undefined && {
          status: parsed.data.status as GiveawayStatus,
        }),
        ...(parsed.data.startsAt !== undefined && { startsAt: parsed.data.startsAt }),
        ...(parsed.data.endsAt !== undefined && { endsAt: parsed.data.endsAt }),
        ...(coverPath !== undefined && { coverPath }),
      },
    });

    res.json(serializable(updated));
  },
);

giveawaysRouter.delete("/giveaways/:id", async (req, res) => {
  const existing = await appPrisma.giveaway.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  await deleteCoverIfAny(existing.coverPath);
  await appPrisma.giveaway.delete({ where: { id: existing.id } });
  res.status(204).end();
});

// ─── lifecycle ─────────────────────────────────────────────────────────────

giveawaysRouter.get("/giveaways/:id/entries", async (req, res) => {
  const platform = req.query.platform;
  const where: { giveawayId: string; platform?: GiveawayPlatform } = {
    giveawayId: req.params.id,
  };
  if (typeof platform === "string") {
    const p = platformEnum.safeParse(platform);
    if (p.success) where.platform = p.data as GiveawayPlatform;
  }
  const entries = await appPrisma.giveawayEntry.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 1000,
  });
  res.json(serializable(entries));
});

giveawaysRouter.post("/giveaways/:id/publish", async (req, res) => {
  const giveaway = await appPrisma.giveaway.findUnique({ where: { id: req.params.id } });
  if (!giveaway) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  if (giveaway.status === "ENDED") {
    res.status(409).json({ error: "already_ended" });
    return;
  }

  const updated = await appPrisma.giveaway.update({
    where: { id: giveaway.id },
    data: { status: "LIVE" },
  });

  await pub.publish(
    CHANNELS.GIVEAWAY_PUBLISH,
    encodeEvent(CHANNELS.GIVEAWAY_PUBLISH, {
      giveawayId: updated.id,
      channelId: updated.channelId,
    }),
  );

  res.json(serializable(updated));
});

const drawQuerySchema = z.object({
  n: z.coerce.number().int().min(1).max(100).optional(),
});

giveawaysRouter.post("/giveaways/:id/draw", async (req, res) => {
  const giveaway = await appPrisma.giveaway.findUnique({ where: { id: req.params.id } });
  if (!giveaway) {
    res.status(404).json({ error: "not_found" });
    return;
  }

  const parsedQuery = drawQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    res.status(400).json({ error: "invalid_query", issues: parsedQuery.error.issues });
    return;
  }
  const n = parsedQuery.data.n ?? giveaway.winnersCount;

  const eligible = await appPrisma.giveawayEntry.findMany({
    where: { giveawayId: giveaway.id, isWinner: false },
    select: { id: true, userId: true },
  });

  if (eligible.length === 0) {
    res.status(409).json({ error: "no_eligible_entries" });
    return;
  }

  const winners = drawWinners(eligible, { n });

  await appPrisma.giveawayEntry.updateMany({
    where: { id: { in: winners.map((w) => w.id) } },
    data: { isWinner: true },
  });

  const winnerRows = await appPrisma.giveawayEntry.findMany({
    where: { id: { in: winners.map((w) => w.id) } },
  });

  res.json(serializable({ winners: winnerRows }));
});

giveawaysRouter.post("/giveaways/:id/announce", async (req, res) => {
  const giveaway = await appPrisma.giveaway.findUnique({
    where: { id: req.params.id },
    include: { entries: { where: { isWinner: true } } },
  });
  if (!giveaway) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  if (giveaway.entries.length === 0) {
    res.status(409).json({ error: "no_winners_drawn" });
    return;
  }

  await appPrisma.giveaway.update({
    where: { id: giveaway.id },
    data: { status: "ENDED" },
  });

  await pub.publish(
    CHANNELS.GIVEAWAY_ANNOUNCE,
    encodeEvent(CHANNELS.GIVEAWAY_ANNOUNCE, {
      giveawayId: giveaway.id,
      winnerUserIds: giveaway.entries.map((e) => e.userId),
    }),
  );

  res.json({ ok: true, winnerCount: giveaway.entries.length });
});
