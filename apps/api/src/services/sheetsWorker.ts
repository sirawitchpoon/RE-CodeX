// Background drain of EntrySyncOutbox → Google Apps Script Web App.
//
// Producer side (bot pickmain commit + API draw handler) writes outbox rows
// inside the same $transaction as the entry/winner write. This worker is the
// only consumer — it polls every POLL_INTERVAL_MS, picks up rows whose
// nextAttemptAt has passed, posts to Apps Script, and marks SYNCED on 2xx.
//
// Failure handling:
//   - 4xx (excluding 408/429) → DEAD immediately (request is malformed, no
//     point retrying with the same payload)
//   - any other failure → attempts++, exponential backoff, retry
//   - after MAX_ATTEMPTS → DEAD (visible in /giveaway/sync-status)
//
// The Apps Script side is responsible for idempotency on its end (it stores
// outbox ids it has seen in PropertiesService) so an at-least-once delivery
// from us never produces duplicate rows in the sheet.

import { appPrisma, type EntrySyncOutbox } from "@recodex/db-app";
import { pointsPrisma } from "@recodex/db-points";
import { env } from "../env.js";
import { logger } from "../logger.js";

const POLL_INTERVAL_MS = 10_000;
const BATCH_SIZE = 25;
const MAX_ATTEMPTS = 8;

// Backoff schedule in ms by attempt count (n=1 means "first retry").
// Caps around 2h so a long Apps Script outage is recoverable without
// DEAD-marking the whole backlog.
const BACKOFF_MS = [
  10_000, // 10s
  60_000, // 1m
  5 * 60_000, // 5m
  15 * 60_000, // 15m
  30 * 60_000, // 30m
  60 * 60_000, // 1h
  2 * 60 * 60_000, // 2h
];

let timer: NodeJS.Timeout | null = null;
let running = false;

export function startSheetsWorker(): void {
  if (!env.SHEETS_WEBHOOK_URL || !env.SHEETS_WEBHOOK_TOKEN) {
    logger.info(
      "sheets worker disabled — SHEETS_WEBHOOK_URL/TOKEN not set; outbox will queue until configured",
    );
    return;
  }
  if (timer) return;
  logger.info({ intervalMs: POLL_INTERVAL_MS }, "sheets worker started");
  timer = setInterval(() => {
    void tick();
  }, POLL_INTERVAL_MS);
  // First run immediately so a freshly-started API drains backlog without
  // waiting a full interval.
  void tick();
}

export function stopSheetsWorker(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

async function tick(): Promise<void> {
  if (running) return; // overlap guard — long Apps Script call shouldn't pile up
  running = true;
  try {
    const due = await appPrisma.entrySyncOutbox.findMany({
      where: { status: "PENDING", nextAttemptAt: { lte: new Date() } },
      orderBy: { createdAt: "asc" },
      take: BATCH_SIZE,
    });
    if (due.length === 0) return;

    for (const row of due) {
      await processOne(row);
    }
  } catch (err) {
    logger.error({ err }, "sheets worker tick failed");
  } finally {
    running = false;
  }
}

interface OutboxPayload {
  entryId: string;
  giveawayId: string;
  giveawayTitle: string;
  userId: string;
  memberId: string;
  memberName?: string;
  contactType: "DISCORD" | "OTHER";
  contactValue: string | null;
  isWinner?: boolean;
  createdAt?: string;
  updatedAt?: string;
  drawnAt?: string;
}

async function processOne(row: EntrySyncOutbox): Promise<void> {
  const payload = row.payload as unknown as OutboxPayload;

  // Enrich with username + memberName (for WINNER_MARK we didn't snapshot
  // memberName because the bot wasn't holding the GiveawayMember row).
  // One round-trip per outbox row is fine at our scale (worst case a few
  // hundred per draw); batching across rows is an optimization for later.
  const [user, member] = await Promise.all([
    pointsPrisma.user.findUnique({ where: { id: payload.userId } }),
    payload.memberName
      ? Promise.resolve(null)
      : pointsPrisma.giveawayMember.findUnique({ where: { id: payload.memberId } }),
  ]);

  const body = {
    outboxId: row.id, // Apps Script uses this for dedup
    type: row.type, // ENTRY_UPSERT | WINNER_MARK
    payload: {
      ...payload,
      memberName: payload.memberName ?? member?.name ?? "(unknown)",
      username: user?.username ?? null,
      displayName: user?.displayName ?? user?.username ?? payload.userId,
    },
  };

  const url = new URL(env.SHEETS_WEBHOOK_URL!);
  url.searchParams.set("token", env.SHEETS_WEBHOOK_TOKEN!);

  let status = 0;
  let errorText: string | null = null;
  try {
    // 30s — Apps Script can be slow on cold starts. Fetch's default is none,
    // so we wrap with AbortController to avoid stalling the worker forever.
    const ctrl = new AbortController();
    const cancel = setTimeout(() => ctrl.abort(), 30_000);
    const resp = await fetch(url.toString(), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    clearTimeout(cancel);
    status = resp.status;
    if (!resp.ok) {
      errorText = (await resp.text().catch(() => "")).slice(0, 500);
    }
  } catch (err) {
    errorText = (err as Error).message;
  }

  if (status >= 200 && status < 300) {
    await appPrisma.entrySyncOutbox.update({
      where: { id: row.id },
      data: { status: "SYNCED", syncedAt: new Date(), lastError: null },
    });
    return;
  }

  const attempts = row.attempts + 1;
  const isPermanentClientError =
    status >= 400 && status < 500 && status !== 408 && status !== 429;
  const givingUp = isPermanentClientError || attempts >= MAX_ATTEMPTS;
  const nextDelay = BACKOFF_MS[Math.min(attempts - 1, BACKOFF_MS.length - 1)]!;
  const nextAttemptAt = new Date(Date.now() + nextDelay);

  await appPrisma.entrySyncOutbox.update({
    where: { id: row.id },
    data: {
      attempts,
      status: givingUp ? "DEAD" : "PENDING",
      nextAttemptAt,
      lastError: errorText
        ? `HTTP ${status}: ${errorText}`
        : `HTTP ${status}`,
    },
  });

  logger.warn(
    {
      outboxId: row.id,
      type: row.type,
      attempts,
      status,
      givingUp,
      err: errorText,
    },
    "sheets sync attempt failed",
  );
}
