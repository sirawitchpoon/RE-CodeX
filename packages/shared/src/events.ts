// Redis pub/sub channel names + payload types.
// Bots publish; the API subscribes and fans out via SSE to the backoffice.

export const CHANNELS = {
  GIVEAWAY_PUBLISH: "giveaway.publish",
  GIVEAWAY_ENTRY: "giveaway.entry",
  GIVEAWAY_ANNOUNCE: "giveaway.announce",
  GIVEAWAY_EDIT: "giveaway.edit",
  GIVEAWAY_CANCEL: "giveaway.cancel",
  LEVEL_UP: "level.up",
  LOG_APPEND: "log.append",
  BOT_HEARTBEAT: "bot.heartbeat",
  LEVEL_CONFIG_CHANGED: "level.config.changed",
} as const;

export type ChannelName = (typeof CHANNELS)[keyof typeof CHANNELS];

export interface GiveawayPublishPayload {
  giveawayId: string;
  channelId: string;
}

export interface GiveawayEntryPayload {
  giveawayId: string;
  userId: string;
  displayName: string;
  platform: string;
  createdAt: string;
}

export interface GiveawayAnnouncePayload {
  giveawayId: string;
  winnerUserIds: string[];
}

export interface GiveawayEditPayload {
  giveawayId: string;
}

export interface GiveawayCancelPayload {
  giveawayId: string;
}

export interface LevelUpPayload {
  guildId: string;
  userId: string;
  oldLevel: number;
  newLevel: number;
  totalXp: string;
}

export interface LogAppendPayload {
  guildId?: string | null;
  level: "INFO" | "WARN" | "ERROR" | "EVENT";
  source: string;
  event: string;
  message: string;
  meta?: Record<string, unknown> | null;
  createdAt: string;
}

export interface BotHeartbeatPayload {
  id: string;
  name: string;
  status: "ONLINE" | "IDLE" | "OFFLINE";
  version: string;
  cpuPct?: number;
  memMb?: number;
  eventCount?: string;
  at: string;
}

export interface LevelConfigChangedPayload {
  guildId: string;
}

export type EventPayloadMap = {
  [CHANNELS.GIVEAWAY_PUBLISH]: GiveawayPublishPayload;
  [CHANNELS.GIVEAWAY_ENTRY]: GiveawayEntryPayload;
  [CHANNELS.GIVEAWAY_ANNOUNCE]: GiveawayAnnouncePayload;
  [CHANNELS.GIVEAWAY_EDIT]: GiveawayEditPayload;
  [CHANNELS.GIVEAWAY_CANCEL]: GiveawayCancelPayload;
  [CHANNELS.LEVEL_UP]: LevelUpPayload;
  [CHANNELS.LOG_APPEND]: LogAppendPayload;
  [CHANNELS.BOT_HEARTBEAT]: BotHeartbeatPayload;
  [CHANNELS.LEVEL_CONFIG_CHANGED]: LevelConfigChangedPayload;
};

export function encodeEvent<C extends ChannelName>(channel: C, payload: EventPayloadMap[C]): string {
  return JSON.stringify(payload);
}

export function decodeEvent<C extends ChannelName>(_channel: C, raw: string): EventPayloadMap[C] {
  return JSON.parse(raw) as EventPayloadMap[C];
}
