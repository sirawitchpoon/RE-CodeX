// Page-facing data hooks. Each hook fetches live data from the API.
// In development (import.meta.env.DEV) the hooks fall back to data.js mocks
// when the API is unreachable. In production the fallback is always an empty
// value so data.js is tree-shaken out of the bundle entirely.
//
// Usage in any page:
//   const { data: GIVEAWAYS } = useGiveaways();

import { useEffect, useMemo, useState } from "react";
import { GIVEAWAYS, ENTRIES, LB, LOGS, BOTS } from "./data.js";
import { api, apiUpload, useApiOrFallback, useSSE, GUILD_ID, BASE } from "./api.js";

// ─── Giveaways ────────────────────────────────────────────────────────────

// Deterministic gradient for giveaways without a cover image. Same id always
// maps to the same swatch so the UI stays stable across reloads.
const GW_GRADIENTS = [
  "linear-gradient(135deg,#c77dff 0%,#7b2cbf 60%,#0a0a0d 100%)",
  "linear-gradient(135deg,#7ae0ff 0%,#4a90e2 60%,#0a0a0d 100%)",
  "linear-gradient(135deg,#6fe39a 0%,#3a8060 60%,#0a0a0d 100%)",
  "linear-gradient(135deg,#ff6b8a 0%,#a04668 60%,#0a0a0d 100%)",
  "linear-gradient(135deg,#ffc266 0%,#cc8a3a 60%,#0a0a0d 100%)",
];
function gradientFor(id) {
  let h = 0;
  for (let i = 0; i < (id ?? "").length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return GW_GRADIENTS[h % GW_GRADIENTS.length];
}

const PLATFORM_LABEL = { TWITTER: "Twitter", BLUESKY: "Bluesky", PIXIV: "Pixiv" };

function fmtEnds(d) {
  if (!d) return "—";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

// Map an API giveaway row to the shape Giveaway.jsx expects. Mock rows from
// data.js already match that shape, so we pass them through untouched.
function adaptGiveaway(g) {
  if (g && g.cover && !g.coverPath) return g;
  const cover = g.coverPath
    ? `url(${BASE}${g.coverPath}) center/cover`
    : gradientFor(g.id);
  return {
    id: g.id,
    title: g.title,
    prize: g.prize,
    status: g.status,
    description: g.description ?? "",
    cover,
    coverPath: g.coverPath ?? null,
    entries: g._count?.entries ?? 0,
    winners: g.winnersCount,
    winnersCount: g.winnersCount,
    ends: fmtEnds(g.endsAt),
    endsAt: g.endsAt ?? null,
    channelId: g.channelId ?? null,
    channelName: g.channelName ?? null,
  };
}

// Map an API entry to the [#, handle, name, platform, @handle, level, role,
// time, isWinner] tuple Giveaway.jsx renders.
function adaptEntry(e, i) {
  const time = e.createdAt
    ? new Date(e.createdAt).toLocaleTimeString("en-GB", { hour12: false })
    : "—";
  return [
    `#${String(i + 1).padStart(3, "0")}`,
    e.handle ?? e.userId ?? "—",
    e.displayName ?? "—",
    PLATFORM_LABEL[e.platform] ?? e.platform ?? "—",
    e.handle ?? "—",
    "—",
    "—",
    time,
    Boolean(e.isWinner),
  ];
}

export function useGiveaways() {
  const path = GUILD_ID
    ? `/api/giveaways?guildId=${encodeURIComponent(GUILD_ID)}`
    : `/api/giveaways`;
  const { data, ...rest } = useApiOrFallback(path, import.meta.env.DEV ? GIVEAWAYS : []);
  const list = useMemo(() => (Array.isArray(data) ? data.map(adaptGiveaway) : []), [data]);
  return { data: list, ...rest };
}

export function useGiveaway(id) {
  const { data, ...rest } = useApiOrFallback(id ? `/api/giveaways/${id}` : null, null, [id]);
  return { data: data ? adaptGiveaway(data) : null, ...rest };
}

export function useGiveawayEntries(id) {
  const path = id ? `/api/giveaways/${id}/entries` : null;
  const { data, ...rest } = useApiOrFallback(path, import.meta.env.DEV ? ENTRIES : [], [id]);
  const rows = useMemo(() => {
    if (!Array.isArray(data)) return [];
    if (data.length > 0 && Array.isArray(data[0])) return data;
    return data.map(adaptEntry);
  }, [data]);
  return { data: rows, ...rest };
}

// ─── Health ───────────────────────────────────────────────────────────────

export function useHealth() {
  return useApiOrFallback(`/api/health`, { ok: true, pointsDb: true, appDb: true, redis: true });
}

// ─── Members ──────────────────────────────────────────────────────────────

const MEMBER_DAY_MS = 24 * 60 * 60 * 1000;
function fmtJoined(d) {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toISOString().slice(0, 10);
}

// Map an API XpTotal+user row into the [username, displayName, role, level,
// status, joined, isBooster] tuple Members.jsx renders.
function adaptMember(row) {
  const u = row.user ?? {};
  const username = u.username ?? row.userId;
  return [
    username,
    u.displayName ?? username,
    "—",
    row.level ?? 0,
    "offline",
    fmtJoined(u.createdAt),
    false,
  ];
}

export function useMembers() {
  const path = GUILD_ID ? `/api/members/${encodeURIComponent(GUILD_ID)}?limit=200` : null;
  const { data, ...rest } = useApiOrFallback(path, []);
  const rows = useMemo(() => {
    if (!Array.isArray(data)) return [];
    if (data.length > 0 && Array.isArray(data[0])) return data;
    return data.map(adaptMember);
  }, [data]);
  return { data: rows, ...rest };
}

// ─── Leaderboard ──────────────────────────────────────────────────────────

export function useLeaderboard(range = "all") {
  const path = GUILD_ID
    ? `/api/leaderboard?guildId=${encodeURIComponent(GUILD_ID)}&range=${range}`
    : null;
  const { data, ...rest } = useApiOrFallback(path, { range, rows: import.meta.env.DEV ? LB : [] }, [range]);
  return { data: data?.rows ?? (import.meta.env.DEV ? LB : []), ...rest };
}

// ─── Logs (initial fill + SSE tail) ───────────────────────────────────────

export function useLogsLive(level) {
  const path = level
    ? `/api/logs?level=${level}&limit=200`
    : `/api/logs?limit=200`;
  const { data: initial } = useApiOrFallback(path, import.meta.env.DEV ? LOGS : [], [level]);
  const [live, setLive] = useState([]);
  useSSE(`/api/events/logs`, {
    "log.append": (row) => setLive((cur) => [row, ...cur].slice(0, 500)),
  });
  return [...live, ...(initial ?? [])];
}

// ─── Dashboard ────────────────────────────────────────────────────────────

export function useDashboard() {
  const path = GUILD_ID
    ? `/api/dashboard/stats?guildId=${encodeURIComponent(GUILD_ID)}`
    : `/api/dashboard/stats`;
  const { data } = useApiOrFallback(path, import.meta.env.DEV ? {
    activeBots: BOTS.length,
    totalBots: BOTS.length,
    totalEvents24h: 0,
    totalMembers: 0,
    bots: BOTS,
  } : null);
  return data;
}

// ─── User profile ─────────────────────────────────────────────────────────

export function useUserProfile(userId) {
  const path =
    GUILD_ID && userId
      ? `/api/users/${encodeURIComponent(GUILD_ID)}/${encodeURIComponent(userId)}?heatmap=84&topChannels=5`
      : null;
  return useApiOrFallback(path, null, [userId]);
}

// ─── Level config ─────────────────────────────────────────────────────────

export function useLevelConfig() {
  const path = GUILD_ID ? `/api/level/${encodeURIComponent(GUILD_ID)}/config` : null;
  return useApiOrFallback(path, null);
}

// ─── Mutators ─────────────────────────────────────────────────────────────

export async function createGiveaway(data, coverFile) {
  const fd = new FormData();
  fd.append("data", JSON.stringify({ guildId: GUILD_ID, ...data }));
  if (coverFile) fd.append("cover", coverFile);
  return apiUpload(`/api/giveaways`, fd);
}
export async function updateGiveaway(id, data, coverFile) {
  const fd = new FormData();
  fd.append("data", JSON.stringify(data));
  if (coverFile) fd.append("cover", coverFile);
  return apiUpload(`/api/giveaways/${id}`, fd, "PATCH");
}
export async function endGiveaway(id) {
  return api(`/api/giveaways/${id}/end`, { method: "POST" });
}
export async function cancelGiveaway(id) {
  return api(`/api/giveaways/${id}/cancel`, { method: "POST" });
}
export async function saveLevelConfig(patch) {
  if (!GUILD_ID) throw new Error("missing_guild_id");
  return api(`/api/level/${encodeURIComponent(GUILD_ID)}/config`, {
    method: "PUT",
    body: JSON.stringify(patch),
  });
}

export async function resetXp() {
  if (!GUILD_ID) throw new Error("missing_guild_id");
  return api(`/api/level/${encodeURIComponent(GUILD_ID)}/xp-reset`, {
    method: "POST",
    body: JSON.stringify({ confirm: "reset" }),
  });
}

export async function publishGiveaway(id) {
  return api(`/api/giveaways/${id}/publish`, { method: "POST" });
}
export async function drawGiveaway(id, n) {
  const q = n ? `?n=${n}` : "";
  return api(`/api/giveaways/${id}/draw${q}`, { method: "POST" });
}
export async function announceGiveaway(id) {
  return api(`/api/giveaways/${id}/announce`, { method: "POST" });
}
