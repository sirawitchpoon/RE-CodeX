// Giveaway routes.
//
// CRUD + image upload + lifecycle (publish / draw / announce). Image lives on
// the API's local volume at ${UPLOADS_DIR}/giveaways/<id>.<ext> and is served
// by the static handler mounted in src/index.ts as /uploads/*.
//
// publish/announce don't talk to Discord directly — they publish to Redis and
// the giveaway bot picks up the message. This keeps the API stateless w.r.t.
// Discord credentials.

import { Router, type Response } from "express";
import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { appPrisma, GiveawayStatus } from "@recodex/db-app";
import { pointsPrisma } from "@recodex/db-points";
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

const statusEnum = z.enum(["DRAFT", "SCHEDULED", "LIVE", "ENDED", "CANCELLED"]);

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

    // If the live announcement exists, ask the bot to re-render the embed so
    // edits to title/prize/description/cover/winners/ends are reflected in
    // Discord. Edits to a non-LIVE giveaway are DB-only.
    if (updated.status === "LIVE" && updated.messageId) {
      await pub.publish(
        CHANNELS.GIVEAWAY_EDIT,
        encodeEvent(CHANNELS.GIVEAWAY_EDIT, { giveawayId: updated.id }),
      );
    }

    res.json(serializable(updated));
  },
);

giveawaysRouter.delete("/giveaways/:id", async (req, res) => {
  const existing = await appPrisma.giveaway.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  // Refuse to delete a LIVE giveaway — its Discord embed is still in chat
  // accepting button presses; the bot has no signal to remove it. Force the
  // admin to End or Cancel first (those flows clean up the embed).
  if (existing.status === "LIVE") {
    res.status(409).json({ error: "live_cannot_delete" });
    return;
  }
  await deleteCoverIfAny(existing.coverPath);
  await appPrisma.giveaway.delete({ where: { id: existing.id } });
  res.status(204).end();
});

// ─── lifecycle ─────────────────────────────────────────────────────────────

giveawaysRouter.get("/giveaways/:id/entries", async (req, res) => {
  const entries = await appPrisma.giveawayEntry.findMany({
    where: { giveawayId: req.params.id },
    orderBy: { createdAt: "desc" },
    take: 1000,
  });

  // Cross-DB join: pull GiveawayMember + User from points-db in one round-trip
  // each, then attach. Per CLAUDE.md the boundary stays soft FK + app-side
  // joins — no Prisma relation across the two databases.
  const memberIds = [...new Set(entries.map((e) => e.memberId))];
  const userIds = [...new Set(entries.map((e) => e.userId))];
  const [members, users] = await Promise.all([
    memberIds.length > 0
      ? pointsPrisma.giveawayMember.findMany({ where: { id: { in: memberIds } } })
      : Promise.resolve([]),
    userIds.length > 0
      ? pointsPrisma.user.findMany({ where: { id: { in: userIds } } })
      : Promise.resolve([]),
  ]);
  const memberMap = new Map(members.map((m) => [m.id, m]));
  const userMap = new Map(users.map((u) => [u.id, u]));

  const enriched = entries.map((e) => ({
    ...e,
    member: memberMap.get(e.memberId) ?? null,
    user: userMap.get(e.userId) ?? null,
  }));

  res.json(serializable(enriched));
});

// ─── CSV exports ───────────────────────────────────────────────────────────
//
// Two endpoints, both meant to be downloaded straight from the backoffice:
//
//   GET /giveaways/:id/entries.csv     → one giveaway, all entries
//   GET /giveaways/winners.csv?guildId → master winners across all giveaways
//
// Both write a UTF-8 BOM so Excel/Sheets opens the Thai characters in member
// names without mojibake. Filenames include a sanitized title so the admin
// can collect many CSVs without renaming.

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = typeof value === "string" ? value : String(value);
  // RFC 4180: quote when value contains delimiter, quote, or newline; double
  // existing quotes inside.
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function csvRow(values: unknown[]): string {
  return values.map(csvEscape).join(",") + "\r\n";
}

function sanitizeFilename(s: string): string {
  // Strip path separators + control chars; collapse whitespace; cap length.
  return s
    .replace(/[\\/:*?"<>|\x00-\x1f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function sendCsv(res: Response, filename: string, body: string): void {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  // BOM keeps Excel happy on UTF-8 (Thai member names + display names).
  res.send("﻿" + body);
}

const ENTRY_HEADERS = [
  "Timestamp",
  "DiscordUserID",
  "Username",
  "DisplayName",
  "Main",
  "ContactType",
  "ContactValue",
  "IsWinner",
  "DrawnAt",
];

const WINNER_HEADERS = [
  "DrawTimestamp",
  "GiveawayID",
  "GiveawayTitle",
  "DiscordUserID",
  "Username",
  "DisplayName",
  "Main",
  "ContactType",
  "ContactValue",
];

giveawaysRouter.get("/giveaways/:id/entries.csv", async (req, res) => {
  const giveaway = await appPrisma.giveaway.findUnique({ where: { id: req.params.id } });
  if (!giveaway) {
    res.status(404).json({ error: "not_found" });
    return;
  }

  const entries = await appPrisma.giveawayEntry.findMany({
    where: { giveawayId: giveaway.id },
    orderBy: { createdAt: "asc" },
  });
  const memberIds = [...new Set(entries.map((e) => e.memberId))];
  const userIds = [...new Set(entries.map((e) => e.userId))];
  const [members, users] = await Promise.all([
    memberIds.length > 0
      ? pointsPrisma.giveawayMember.findMany({ where: { id: { in: memberIds } } })
      : Promise.resolve([]),
    userIds.length > 0
      ? pointsPrisma.user.findMany({ where: { id: { in: userIds } } })
      : Promise.resolve([]),
  ]);
  const memberMap = new Map(members.map((m) => [m.id, m]));
  const userMap = new Map(users.map((u) => [u.id, u]));

  let body = csvRow(ENTRY_HEADERS);
  for (const e of entries) {
    const u = userMap.get(e.userId);
    body += csvRow([
      e.createdAt.toISOString(),
      e.userId,
      u?.username ?? "",
      u?.displayName ?? u?.username ?? "",
      memberMap.get(e.memberId)?.name ?? "",
      e.contactType,
      e.contactValue ?? "",
      e.isWinner ? "TRUE" : "FALSE",
      e.drawnAt ? e.drawnAt.toISOString() : "",
    ]);
  }

  const slug = sanitizeFilename(giveaway.title) || giveaway.id;
  sendCsv(res, `giveaway-${giveaway.id}-${slug}.csv`, body);
});

// NOTE: path intentionally NOT under `/giveaways/:id/...` — Express would
// match `/giveaways/winners.csv` against the `/giveaways/:id` handler first
// and 404 (treating "winners.csv" as the id).
giveawaysRouter.get("/giveaways-winners.csv", async (req, res) => {
  const guildId = typeof req.query.guildId === "string" ? req.query.guildId : null;
  const giveaways = await appPrisma.giveaway.findMany({
    where: guildId ? { guildId } : undefined,
    select: { id: true, title: true },
  });
  const giveawayMap = new Map(giveaways.map((g) => [g.id, g.title]));

  const winners = await appPrisma.giveawayEntry.findMany({
    where: {
      isWinner: true,
      ...(guildId ? { giveaway: { guildId } } : {}),
    },
    orderBy: { drawnAt: "asc" },
  });

  const memberIds = [...new Set(winners.map((w) => w.memberId))];
  const userIds = [...new Set(winners.map((w) => w.userId))];
  const [members, users] = await Promise.all([
    memberIds.length > 0
      ? pointsPrisma.giveawayMember.findMany({ where: { id: { in: memberIds } } })
      : Promise.resolve([]),
    userIds.length > 0
      ? pointsPrisma.user.findMany({ where: { id: { in: userIds } } })
      : Promise.resolve([]),
  ]);
  const memberMap = new Map(members.map((m) => [m.id, m]));
  const userMap = new Map(users.map((u) => [u.id, u]));

  let body = csvRow(WINNER_HEADERS);
  for (const w of winners) {
    const u = userMap.get(w.userId);
    body += csvRow([
      // Fall back to createdAt for legacy winners drawn before drawnAt was
      // introduced — they'll show the entry creation time instead of null.
      (w.drawnAt ?? w.createdAt).toISOString(),
      w.giveawayId,
      giveawayMap.get(w.giveawayId) ?? "",
      w.userId,
      u?.username ?? "",
      u?.displayName ?? u?.username ?? "",
      memberMap.get(w.memberId)?.name ?? "",
      w.contactType,
      w.contactValue ?? "",
    ]);
  }

  const stamp = new Date().toISOString().slice(0, 10);
  sendCsv(res, `winners-${stamp}.csv`, body);
});

giveawaysRouter.post("/giveaways/:id/publish", async (req, res) => {
  const giveaway = await appPrisma.giveaway.findUnique({ where: { id: req.params.id } });
  if (!giveaway) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  if (giveaway.status === "ENDED" || giveaway.status === "CANCELLED") {
    res.status(409).json({ error: "already_finalized" });
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
  if (giveaway.status === "CANCELLED") {
    res.status(409).json({ error: "already_cancelled" });
    return;
  }

  const parsedQuery = drawQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    res.status(400).json({ error: "invalid_query", issues: parsedQuery.error.issues });
    return;
  }
  const n = parsedQuery.data.n ?? giveaway.winnersCount;

  // Idempotent draw: a second call with winners already persisted returns the
  // same set instead of pulling more entries on top. Run the read+pick+mark
  // inside one transaction so two simultaneous calls cannot both pass the
  // "no winners yet" gate.
  const winnerRows = await appPrisma.$transaction(async (tx) => {
    const existing = await tx.giveawayEntry.findMany({
      where: { giveawayId: giveaway.id, isWinner: true },
    });
    if (existing.length > 0) return existing;

    const eligible = await tx.giveawayEntry.findMany({
      where: { giveawayId: giveaway.id, isWinner: false },
      select: { id: true, userId: true },
    });
    if (eligible.length === 0) return [];

    const picks = drawWinners(eligible, { n });
    const pickIds = picks.map((w) => w.id);
    await tx.giveawayEntry.updateMany({
      where: { id: { in: pickIds } },
      data: { isWinner: true, drawnAt: new Date() },
    });
    return tx.giveawayEntry.findMany({
      where: { id: { in: pickIds } },
    });
  });

  if (winnerRows.length === 0) {
    res.status(409).json({ error: "no_eligible_entries" });
    return;
  }

  // Cross-DB join — admin needs to see Discord username + main name + contact
  // when announcing winners.
  const memberIds = [...new Set(winnerRows.map((w) => w.memberId))];
  const userIds = [...new Set(winnerRows.map((w) => w.userId))];
  const [members, users] = await Promise.all([
    memberIds.length > 0
      ? pointsPrisma.giveawayMember.findMany({ where: { id: { in: memberIds } } })
      : Promise.resolve([]),
    userIds.length > 0
      ? pointsPrisma.user.findMany({ where: { id: { in: userIds } } })
      : Promise.resolve([]),
  ]);
  const memberMap = new Map(members.map((m) => [m.id, m]));
  const userMap = new Map(users.map((u) => [u.id, u]));
  const enriched = winnerRows.map((w) => ({
    ...w,
    member: memberMap.get(w.memberId) ?? null,
    user: userMap.get(w.userId) ?? null,
  }));

  res.json(serializable({ winners: enriched }));
});

giveawaysRouter.post("/giveaways/:id/end", async (req, res) => {
  const giveaway = await appPrisma.giveaway.findUnique({ where: { id: req.params.id } });
  if (!giveaway) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  if (giveaway.status === "ENDED" || giveaway.status === "CANCELLED") {
    res.status(409).json({ error: "already_finalized" });
    return;
  }

  const updated = await appPrisma.giveaway.update({
    where: { id: giveaway.id },
    data: { status: "ENDED" },
  });

  if (updated.messageId) {
    await pub.publish(
      CHANNELS.GIVEAWAY_EDIT,
      encodeEvent(CHANNELS.GIVEAWAY_EDIT, { giveawayId: updated.id }),
    );
  }

  await appPrisma.log.create({
    data: {
      guildId: giveaway.guildId,
      level: "EVENT",
      source: "RX.Giveaway",
      event: "giveaway.ended",
      message: `Ended "${giveaway.title}" without announcing winners`,
      meta: { giveawayId: giveaway.id },
    },
  });

  res.json(serializable(updated));
});

giveawaysRouter.post("/giveaways/:id/cancel", async (req, res) => {
  const giveaway = await appPrisma.giveaway.findUnique({ where: { id: req.params.id } });
  if (!giveaway) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  if (giveaway.status === "CANCELLED") {
    res.status(409).json({ error: "already_cancelled" });
    return;
  }

  const updated = await appPrisma.giveaway.update({
    where: { id: giveaway.id },
    data: { status: "CANCELLED" },
  });

  if (updated.messageId) {
    await pub.publish(
      CHANNELS.GIVEAWAY_CANCEL,
      encodeEvent(CHANNELS.GIVEAWAY_CANCEL, { giveawayId: updated.id }),
    );
  }

  await appPrisma.log.create({
    data: {
      guildId: giveaway.guildId,
      level: "EVENT",
      source: "RX.Giveaway",
      event: "giveaway.cancelled",
      message: `Cancelled "${giveaway.title}"`,
      meta: { giveawayId: giveaway.id },
    },
  });

  res.json(serializable(updated));
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
