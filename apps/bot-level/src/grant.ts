// Single-writer for XP. Wraps insert+upsert+level recompute in a Prisma
// transaction so XpEvent and XpTotal can never disagree. If the level
// crosses, role rewards get applied (synchronously add Discord roles) and
// `level.up` is published.

import type { Guild } from "discord.js";
import {
  pointsPrisma,
  type XpSource,
  type RoleReward,
} from "@recodex/db-points";
import {
  CHANNELS,
  encodeEvent,
  levelForXp,
  type LevelCurveConfig,
} from "@recodex/shared";
import { pub } from "./redis.js";
import { logger } from "./logger.js";

export interface GrantInput {
  guildId: string;
  userId: string;
  source: XpSource;
  amount: number;
  channelId?: string | null;
  messageId?: string | null;
}

export interface GrantResult {
  totalXp: bigint;
  oldLevel: number;
  newLevel: number;
  leveledUp: boolean;
}

/** SOURCE → which per-source counter to increment on XpTotal */
const COUNTER_FIELD: Record<XpSource, keyof Pick<
  Awaited<ReturnType<typeof pointsPrisma.xpTotal.upsert>>,
  "textXp" | "voiceXp" | "reactionXp" | "stageXp"
> | null> = {
  TEXT: "textXp",
  VOICE: "voiceXp",
  REACTION: "reactionXp",
  STAGE: "stageXp",
  STREAK: null,
  MANUAL: null,
};

export async function grantXp(
  input: GrantInput,
  cfg: LevelCurveConfig,
): Promise<GrantResult> {
  return pointsPrisma.$transaction(async (tx) => {
    await tx.xpEvent.create({
      data: {
        guildId: input.guildId,
        userId: input.userId,
        source: input.source,
        amount: input.amount,
        channelId: input.channelId ?? null,
        messageId: input.messageId ?? null,
      },
    });
    const counter = COUNTER_FIELD[input.source];
    const updated = await tx.xpTotal.upsert({
      where: { guildId_userId: { guildId: input.guildId, userId: input.userId } },
      update: {
        totalXp: { increment: input.amount },
        ...(counter ? { [counter]: { increment: input.amount } } : {}),
        lastGrantAt: new Date(),
      },
      create: {
        guildId: input.guildId,
        userId: input.userId,
        totalXp: input.amount,
        ...(counter ? { [counter]: input.amount } : {}),
        level: 0,
        lastGrantAt: new Date(),
      },
    });
    const newLevel = levelForXp(updated.totalXp, cfg);
    if (newLevel !== updated.level) {
      await tx.xpTotal.update({
        where: { guildId_userId: { guildId: input.guildId, userId: input.userId } },
        data: { level: newLevel },
      });
    }
    return {
      totalXp: updated.totalXp,
      oldLevel: updated.level,
      newLevel,
      leveledUp: newLevel > updated.level,
    };
  });
}

/**
 * Apply role rewards and publish level.up. Discord client is required only
 * for role assignment; if omitted (e.g. tests) the side-effect is skipped.
 */
export async function applyLevelUp(
  guild: Guild | null,
  input: GrantInput,
  result: GrantResult,
  rewards: readonly RoleReward[],
): Promise<void> {
  await pub.publish(
    CHANNELS.LEVEL_UP,
    encodeEvent(CHANNELS.LEVEL_UP, {
      guildId: input.guildId,
      userId: input.userId,
      oldLevel: result.oldLevel,
      newLevel: result.newLevel,
      totalXp: result.totalXp.toString(),
    }),
  );

  if (!guild) return;
  const eligible = rewards.filter((r) => r.level <= result.newLevel);
  if (eligible.length === 0) return;

  try {
    const member = await guild.members.fetch(input.userId);
    const missing = eligible.filter((r) => !member.roles.cache.has(r.roleId));
    if (missing.length > 0) {
      await member.roles.add(missing.map((r) => r.roleId), `Re:CodeX level up to Lv.${result.newLevel}`);
    }
  } catch (err) {
    logger.warn({ err, userId: input.userId }, "level role add failed");
  }
}
