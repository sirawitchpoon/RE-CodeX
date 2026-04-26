// Modal submit → eligibility check (role + min level via points-db.XpTotal +
// member roles) → insert GiveawayEntry → ephemeral confirmation.

import {
  type Client,
  type Interaction,
  type GuildMember,
} from "discord.js";
import { appPrisma, GiveawayPlatform } from "@recodex/db-app";
import { pointsPrisma } from "@recodex/db-points";
import { CHANNELS, encodeEvent } from "@recodex/shared";
import { pub } from "../redis.js";
import { logger } from "../logger.js";
import { MODAL_CUSTOM_ID_PREFIX } from "./button.js";

const PLATFORM_MAP: Record<string, GiveawayPlatform> = {
  twitter: "TWITTER",
  x: "TWITTER",
  bluesky: "BLUESKY",
  bsky: "BLUESKY",
  pixiv: "PIXIV",
};

function normalizePlatform(raw: string): GiveawayPlatform | null {
  const key = raw.trim().toLowerCase();
  return PLATFORM_MAP[key] ?? null;
}

export function registerModalHandler(client: Client): void {
  client.on("interactionCreate", async (interaction: Interaction) => {
    if (!interaction.isModalSubmit()) return;
    if (!interaction.customId.startsWith(MODAL_CUSTOM_ID_PREFIX)) return;

    const giveawayId = interaction.customId.slice(MODAL_CUSTOM_ID_PREFIX.length);

    const displayName = interaction.fields.getTextInputValue("displayName").trim();
    const platformRaw = interaction.fields.getTextInputValue("platform").trim();
    const handle = interaction.fields.getTextInputValue("handle").trim() || null;
    const messageBody = interaction.fields.getTextInputValue("message").trim() || null;

    const platform = normalizePlatform(platformRaw);
    if (!platform) {
      await interaction.reply({
        ephemeral: true,
        content: "❌ Platform ต้องเป็น **Twitter**, **Bluesky**, หรือ **Pixiv** เท่านั้น",
      });
      return;
    }

    const giveaway = await appPrisma.giveaway.findUnique({ where: { id: giveawayId } });
    if (!giveaway) {
      await interaction.reply({ ephemeral: true, content: "❌ Giveaway นี้ไม่มีอยู่แล้ว" });
      return;
    }
    if (giveaway.status !== "LIVE") {
      await interaction.reply({ ephemeral: true, content: "❌ Giveaway นี้ปิดรับสมัครแล้ว" });
      return;
    }

    // Role + min-level eligibility
    if (giveaway.requiredRoleId || giveaway.minLevel > 0) {
      const member = interaction.member as GuildMember | null;
      if (giveaway.requiredRoleId) {
        const has = member?.roles?.cache?.has(giveaway.requiredRoleId);
        if (!has) {
          await interaction.reply({
            ephemeral: true,
            content: `❌ คุณต้องมี role <@&${giveaway.requiredRoleId}> เพื่อเข้าร่วม`,
          });
          return;
        }
      }
      if (giveaway.minLevel > 0) {
        const total = await pointsPrisma.xpTotal.findUnique({
          where: { guildId_userId: { guildId: giveaway.guildId, userId: interaction.user.id } },
        });
        if (!total || total.level < giveaway.minLevel) {
          await interaction.reply({
            ephemeral: true,
            content: `❌ ต้องการเลเวลขั้นต่ำ Lv.${giveaway.minLevel} (คุณอยู่ Lv.${total?.level ?? 0})`,
          });
          return;
        }
      }
    }

    // Mirror user into points-db so soft FK is meaningful for joins
    await pointsPrisma.user
      .upsert({
        where: { id: interaction.user.id },
        update: {
          username: interaction.user.username,
          displayName: interaction.user.globalName ?? null,
          avatarHash: interaction.user.avatar ?? null,
        },
        create: {
          id: interaction.user.id,
          username: interaction.user.username,
          displayName: interaction.user.globalName ?? null,
          avatarHash: interaction.user.avatar ?? null,
        },
      })
      .catch((err) => logger.warn({ err }, "user upsert failed"));

    try {
      const entry = await appPrisma.giveawayEntry.create({
        data: {
          giveawayId,
          userId: interaction.user.id,
          displayName,
          platform,
          handle,
          message: messageBody,
        },
      });

      await pub.publish(
        CHANNELS.GIVEAWAY_ENTRY,
        encodeEvent(CHANNELS.GIVEAWAY_ENTRY, {
          giveawayId,
          userId: interaction.user.id,
          displayName,
          platform,
          createdAt: entry.createdAt.toISOString(),
        }),
      );

      await appPrisma.log
        .create({
          data: {
            guildId: giveaway.guildId,
            level: "EVENT",
            source: "RX.Giveaway",
            event: "entry.created",
            message: `${interaction.user.username} joined "${giveaway.title}"`,
            meta: { giveawayId, userId: interaction.user.id, platform },
          },
        })
        .catch(() => null);

      await interaction.reply({
        ephemeral: true,
        content: `✅ เข้าร่วมเรียบร้อย! ขอให้โชคดี ${displayName} ✨`,
      });
    } catch (err) {
      // unique violation → already entered
      const code = (err as { code?: string }).code;
      if (code === "P2002") {
        await interaction.reply({
          ephemeral: true,
          content: "⚠️ คุณเคยสมัคร Giveaway นี้ไปแล้ว",
        });
        return;
      }
      logger.error({ err, giveawayId }, "modal entry create failed");
      await interaction.reply({
        ephemeral: true,
        content: "❌ เกิดข้อผิดพลาด ลองอีกครั้งหรือแจ้งทีมงาน",
      });
    }
  });
}
