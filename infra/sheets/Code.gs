/**
 * Re:CodeX — Giveaway Sheets sync receiver.
 *
 * Paste this whole file into the Apps Script editor of the destination
 * Spreadsheet (Extensions → Apps Script). Then:
 *
 *   1. File → Project Settings → Script Properties → add:
 *        WEBHOOK_TOKEN = <a long random secret, paste the same value into
 *                        SHEETS_WEBHOOK_TOKEN in the API .env>
 *
 *   2. Deploy → New deployment → Type: Web app
 *        Execute as: Me
 *        Who has access: Anyone (the token in the URL is the auth gate)
 *
 *   3. Copy the deployment URL into SHEETS_WEBHOOK_URL in the API .env and
 *      restart the API container. The worker drains backlog on first tick.
 *
 * The receiver is idempotent: every payload carries an `outboxId` and we
 * skip ones we've already processed. Safe to retry from the API side.
 */

const HEADERS_PER_GIVEAWAY = [
  "Timestamp",
  "DiscordUserID",
  "Username",
  "DisplayName",
  "Main",
  "ContactType",
  "ContactValue",
  "IsWinner",
  "UpdatedAt",
];

const HEADERS_WINNERS = [
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

const WINNERS_TAB = "Winners";
const SEEN_PROP_PREFIX = "seen:";
// Apps Script PropertiesService limit is ~9KB per value; we cap retained
// outbox-ids per shard to avoid hitting it. 5000 ids covers months of
// activity at our volume.
const SEEN_SHARD_SIZE = 5000;

// Apps Script Web Apps always return HTTP 200 unless the script throws (then
// the platform returns 5xx). To signal hard failures back to the caller we
// throw — the API worker treats 5xx as "retry with backoff", which is
// exactly what we want for both transient errors and admin misconfig.
//   - thrown = retry (admin fixes token/URL → next attempt succeeds)
//   - returned ok:true = SYNCED, drop from outbox
function doPost(e) {
  const token = e.parameter && e.parameter.token;
  const expected = PropertiesService.getScriptProperties().getProperty("WEBHOOK_TOKEN");
  if (!expected || token !== expected) {
    throw new Error("unauthorized");
  }

  const body = JSON.parse(e.postData.contents);
  const outboxId = body.outboxId;
  if (!outboxId) throw new Error("missing_outboxId");

  if (alreadySeen(outboxId)) {
    return jsonOk({ ok: true, deduped: true });
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (body.type === "ENTRY_UPSERT") {
    handleEntryUpsert(ss, body.payload);
  } else if (body.type === "WINNER_MARK") {
    handleWinnerMark(ss, body.payload);
  } else {
    throw new Error("unknown_type:" + body.type);
  }

  markSeen(outboxId);
  return jsonOk({ ok: true });
}

// Health check for "is the URL alive" curl from the API host.
function doGet() {
  return jsonOk({ ok: true, service: "recodex-giveaway-sheets" });
}

// ─── ENTRY_UPSERT ──────────────────────────────────────────────────────────

function handleEntryUpsert(ss, p) {
  const sheet = ensureGiveawaySheet(ss, p.giveawayId, p.giveawayTitle);
  const headerRow = HEADERS_PER_GIVEAWAY;
  const userIdCol = headerRow.indexOf("DiscordUserID") + 1; // 1-based for getRange

  // Find existing row by DiscordUserID. Reading the whole id column once
  // beats per-row find() and stays under Apps Script's 6-min cap easily.
  const lastRow = sheet.getLastRow();
  let targetRow = -1;
  if (lastRow >= 2) {
    const ids = sheet
      .getRange(2, userIdCol, lastRow - 1, 1)
      .getValues()
      .map((r) => String(r[0]));
    const idx = ids.indexOf(String(p.userId));
    if (idx >= 0) targetRow = idx + 2;
  }

  const row = [
    new Date(),
    p.userId,
    p.username || "",
    p.displayName || "",
    p.memberName || "",
    p.contactType || "",
    p.contactValue || "",
    Boolean(p.isWinner),
    p.updatedAt ? new Date(p.updatedAt) : new Date(),
  ];

  if (targetRow > 0) {
    sheet.getRange(targetRow, 1, 1, row.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }
}

// ─── WINNER_MARK ────────────────────────────────────────────────────────────

function handleWinnerMark(ss, p) {
  // 1. Mark IsWinner = TRUE in the giveaway tab.
  const sheet = ensureGiveawaySheet(ss, p.giveawayId, p.giveawayTitle);
  const userIdCol = HEADERS_PER_GIVEAWAY.indexOf("DiscordUserID") + 1;
  const winnerCol = HEADERS_PER_GIVEAWAY.indexOf("IsWinner") + 1;
  const lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    const ids = sheet
      .getRange(2, userIdCol, lastRow - 1, 1)
      .getValues()
      .map((r) => String(r[0]));
    const idx = ids.indexOf(String(p.userId));
    if (idx >= 0) {
      sheet.getRange(idx + 2, winnerCol).setValue(true);
    }
  }

  // 2. Append to the Winners master tab.
  const winners = ensureWinnersSheet(ss);
  winners.appendRow([
    p.drawnAt ? new Date(p.drawnAt) : new Date(),
    p.giveawayId,
    p.giveawayTitle,
    p.userId,
    p.username || "",
    p.displayName || "",
    p.memberName || "",
    p.contactType || "",
    p.contactValue || "",
  ]);
}

// ─── Sheet helpers ─────────────────────────────────────────────────────────

function ensureGiveawaySheet(ss, giveawayId, title) {
  const tabName = sanitizeTabName("#" + giveawayId + " " + (title || ""));
  let sheet = ss.getSheetByName(tabName);
  if (!sheet) {
    sheet = ss.insertSheet(tabName);
    sheet.appendRow(HEADERS_PER_GIVEAWAY);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function ensureWinnersSheet(ss) {
  let sheet = ss.getSheetByName(WINNERS_TAB);
  if (!sheet) {
    sheet = ss.insertSheet(WINNERS_TAB, 0); // pin to leftmost slot
    sheet.appendRow(HEADERS_WINNERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// Google Sheets tab names cap at 100 chars and reject \ / ? * [ ] :
function sanitizeTabName(name) {
  const cleaned = String(name).replace(/[\\\/\?\*\[\]:]/g, "").trim();
  return cleaned.length > 95 ? cleaned.slice(0, 95) : cleaned;
}

// ─── Idempotency (PropertiesService dedup) ─────────────────────────────────
// Sharded by hash so no single property exceeds the 9KB value limit even
// after thousands of entries. Each shard holds up to SEEN_SHARD_SIZE ids.

function shardKeyFor(outboxId) {
  // Deterministic shard from first 2 chars of cuid — gives us 36*36 buckets.
  const h = outboxId.substring(0, 2).toLowerCase();
  return SEEN_PROP_PREFIX + h;
}

function alreadySeen(outboxId) {
  const props = PropertiesService.getScriptProperties();
  const raw = props.getProperty(shardKeyFor(outboxId));
  if (!raw) return false;
  const list = raw.split(",");
  return list.indexOf(outboxId) >= 0;
}

function markSeen(outboxId) {
  const props = PropertiesService.getScriptProperties();
  const key = shardKeyFor(outboxId);
  const raw = props.getProperty(key) || "";
  const list = raw ? raw.split(",") : [];
  list.push(outboxId);
  // Drop oldest when shard fills — at our volume the API has long since
  // marked them SYNCED so re-receiving one would be harmless dedup loss.
  if (list.length > SEEN_SHARD_SIZE) {
    list.splice(0, list.length - SEEN_SHARD_SIZE);
  }
  props.setProperty(key, list.join(","));
}

// ─── Response helper ────────────────────────────────────────────────────────

function jsonOk(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
