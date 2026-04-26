// SSE hub. The API subscribes to Redis channels at boot and fans every
// message out to all connected SSE responses for the matching topic.
//
// Topic vs. channel naming:
//   - "topic" = SSE endpoint name ('logs', 'dashboard') — what the frontend
//     subscribes to
//   - "channel" = Redis pub/sub channel name ('log.append', 'bot.heartbeat',
//     etc.) — declared in @recodex/shared CHANNELS
//
// One Redis channel can fan out to multiple SSE topics (e.g. bot.heartbeat
// goes to both 'logs' and 'dashboard').

import type { Request, Response } from "express";
import { CHANNELS, type ChannelName } from "@recodex/shared";
import { logger } from "./logger.js";

export type Topic = "logs" | "dashboard";

// Which Redis channels each SSE topic wants to see
export const TOPIC_CHANNELS: Record<Topic, readonly ChannelName[]> = {
  logs: [CHANNELS.LOG_APPEND, CHANNELS.BOT_HEARTBEAT],
  dashboard: [
    CHANNELS.BOT_HEARTBEAT,
    CHANNELS.LEVEL_UP,
    CHANNELS.GIVEAWAY_ENTRY,
    CHANNELS.GIVEAWAY_PUBLISH,
  ],
};

// Inverse map: Redis channel → topics that should receive it
const CHANNEL_TO_TOPICS: Map<ChannelName, Topic[]> = (() => {
  const m = new Map<ChannelName, Topic[]>();
  for (const [topic, channels] of Object.entries(TOPIC_CHANNELS) as [
    Topic,
    readonly ChannelName[],
  ][]) {
    for (const ch of channels) {
      const list = m.get(ch) ?? [];
      list.push(topic);
      m.set(ch, list);
    }
  }
  return m;
})();

class SSEHub {
  private connections = new Map<Topic, Set<Response>>();
  private heartbeatTimer: NodeJS.Timeout | null = null;

  attach(topic: Topic, req: Request, res: Response): void {
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();
    res.write(": connected\n\n");

    const set = this.connections.get(topic) ?? new Set<Response>();
    set.add(res);
    this.connections.set(topic, set);

    const cleanup = () => {
      set.delete(res);
      logger.debug(
        { topic, remaining: set.size },
        "sse client disconnected",
      );
    };
    req.on("close", cleanup);
    req.on("error", cleanup);
  }

  /**
   * Broadcast a Redis message to every SSE topic that subscribes to its
   * channel. The SSE event name is the channel name; the data is the raw
   * JSON string from Redis (we don't re-parse — pass-through is enough).
   */
  broadcastFromRedis(channel: ChannelName, raw: string): void {
    const topics = CHANNEL_TO_TOPICS.get(channel);
    if (!topics) return;
    const frame = `event: ${channel}\ndata: ${raw}\n\n`;
    for (const topic of topics) {
      const set = this.connections.get(topic);
      if (!set || set.size === 0) continue;
      for (const res of set) {
        try {
          res.write(frame);
        } catch (err) {
          logger.warn({ err, topic, channel }, "sse write failed");
        }
      }
    }
  }

  startHeartbeat(intervalMs = 15000): void {
    if (this.heartbeatTimer) return;
    this.heartbeatTimer = setInterval(() => {
      for (const set of this.connections.values()) {
        for (const res of set) {
          try {
            res.write(": ping\n\n");
          } catch {
            /* dropped on next write */
          }
        }
      }
    }, intervalMs);
    this.heartbeatTimer.unref?.();
  }

  stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  closeAll(): void {
    for (const set of this.connections.values()) {
      for (const res of set) {
        try {
          res.end();
        } catch {
          /* ignore */
        }
      }
      set.clear();
    }
  }
}

export const hub = new SSEHub();
