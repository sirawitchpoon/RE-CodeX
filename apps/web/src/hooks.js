// Page-facing data hooks. Each one preserves the mock shape from data.js so
// existing JSX continues to render unchanged when the API is unreachable.
//
// Usage in any page:
//   const { data: GIVEAWAYS } = useGiveaways();
// instead of:
//   import { GIVEAWAYS } from "../data.js";

import { useEffect, useState } from "react";
import { GIVEAWAYS, ENTRIES, LB, LOGS, BOTS } from "./data.js";
import { api, useApiOrFallback, useSSE, GUILD_ID } from "./api.js";

// ─── Giveaways ────────────────────────────────────────────────────────────

export function useGiveaways() {
  const path = GUILD_ID
    ? `/api/giveaways?guildId=${encodeURIComponent(GUILD_ID)}`
    : `/api/giveaways`;
  return useApiOrFallback(path, GIVEAWAYS);
}

export function useGiveaway(id) {
  return useApiOrFallback(id ? `/api/giveaways/${id}` : null, null, [id]);
}

export function useGiveawayEntries(id) {
  const path = id ? `/api/giveaways/${id}/entries` : null;
  return useApiOrFallback(path, ENTRIES, [id]);
}

// ─── Leaderboard ──────────────────────────────────────────────────────────

export function useLeaderboard(range = "all") {
  const path = GUILD_ID
    ? `/api/leaderboard?guildId=${encodeURIComponent(GUILD_ID)}&range=${range}`
    : null;
  const { data, ...rest } = useApiOrFallback(path, { range, rows: LB }, [range]);
  return { data: data?.rows ?? LB, ...rest };
}

// ─── Logs (initial fill + SSE tail) ───────────────────────────────────────

export function useLogsLive(level) {
  const path = level
    ? `/api/logs?level=${level}&limit=200`
    : `/api/logs?limit=200`;
  const { data: initial } = useApiOrFallback(path, LOGS, [level]);
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
  const { data } = useApiOrFallback(path, {
    activeBots: BOTS.length,
    totalBots: BOTS.length,
    totalEvents24h: 0,
    totalMembers: 0,
    bots: BOTS,
  });
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
