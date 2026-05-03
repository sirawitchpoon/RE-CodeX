// LIVE embed buttons → start the pickmain flow.
//
//   customId `gw:join:<gid>` (Primary)   — first-time/repeat entry
//   customId `gw:edit:<gid>` (Secondary) — change main or contact for an
//                                         existing entry
//
// Both routes: status check + eligibility check + mirror user into points-db,
// then show an ephemeral with one button per GiveawayMember (mode flag
// `n`=new / `e`=edit baked into each button's customId so the next handler
// can pick the right INSERT vs UPDATE branch).

import {
  type Client,
  type Interaction,
  type GuildMember,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} from "discord.js";
import { appPrisma } from "@recodex/db-app";
import { pointsPrisma } from "@recodex/db-points";
import { DEFAULT_BRANDING, renderLabel } from "@recodex/shared";
import { logger } from "../logger.js";
import { loadMembers } from "../membersCache.js";

export const JOIN_CUSTOM_ID_PREFIX = "gw:join:";
export const EDIT_CUSTOM_ID_PREFIX = "gw:edit:";

type Mode = "n" | "e";

export function registerButtonHandler(client: Client): void {
  client.on("interactionCreate", async (interaction: Interaction) => {
    if (!interaction.isButton()) return;
    const id = interaction.customId;
    if (id.startsWith(JOIN_CUSTOM_ID_PREFIX)) {
      await handleEntry(
        interaction,
        id.slice(JOIN_CUSTOM_ID_PREFIX.length),
        "n",
      );
    } else if (id.startsWith(EDIT_CUSTOM_ID_PREFIX)) {
      await handleEntry(
        interaction,
        id.slice(EDIT_CUSTOM_ID_PREFIX.length),
        "e",
      );
    }
  });
}

async function handleEntry(
  interaction: import("discord.js").ButtonInteraction,
  giveawayId: string,
  mode: Mode,
): Promise<void> {
  const giveaway = await appPrisma.giveaway.findUnique({
    where: { id: giveawayId },
  });
  if (!giveaway) {
    await safeReply(interaction, "❌ Giveaway นี้ไม่มีอยู่แล้ว");
    return;
  }
  if (giveaway.status !== "LIVE") {
    await safeReply(interaction, "❌ Giveaway นี้ปิดรับสมัครแล้ว");
    return;
  }

  // Eligibility (role + min level) — same as the old modal handler.
  if (giveaway.requiredRoleId) {
    const member = interaction.member as GuildMember | null;
    if (!member?.roles?.cache?.has(giveaway.requiredRoleId)) {
      await safeReply(
        interaction,
        `❌ คุณต้องมี role <@&${giveaway.requiredRoleId}> เพื่อเข้าร่วม`,
      );
      return;
    }
  }
  if (giveaway.minLevel > 0) {
    const total = await pointsPrisma.xpTotal.findUnique({
      where: {
        guildId_userId: {
          guildId: giveaway.guildId,
          userId: interaction.user.id,
        },
      },
    });
    if (!total || total.level < giveaway.minLevel) {
      await safeReply(
        interaction,
        `❌ ต้องการเลเวลขั้นต่ำ Lv.${giveaway.minLevel} (คุณอยู่ Lv.${total?.level ?? 0})`,
      );
      return;
    }
  }

  // Mirror user into points-db so cross-DB joins from the API have data.
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

  const existing = await appPrisma.giveawayEntry.findUnique({
    where: {
      giveawayId_userId: { giveawayId, userId: interaction.user.id },
    },
  });

  if (mode === "n" && existing) {
    await safeReply(
      interaction,
      "⚠️ คุณเข้าร่วมแล้ว ใช้ปุ่ม **แก้ไขข้อมูล** เพื่อเปลี่ยนเมน/ช่องทางติดต่อ",
    );
    return;
  }
  if (mode === "e" && !existing) {
    await safeReply(
      interaction,
      "❌ คุณยังไม่ได้เข้าร่วม — กดปุ่ม **เข้าร่วม** ก่อน",
    );
    return;
  }

  const members = await loadMembers(giveaway.guildId);
  if (members.length === 0) {
    await safeReply(
      interaction,
      "❌ ยังไม่ได้ตั้งค่าเมนใน server — แจ้งทีมงานให้เพิ่มสมาชิกก่อน",
    );
    return;
  }

  const branding = await pointsPrisma.brandingConfig.findUnique({
    where: { guildId: giveaway.guildId },
  });
  const b = branding ?? DEFAULT_BRANDING;

  const currentMain = await pointsPrisma.userMain.findUnique({
    where: {
      guildId_userId: {
        guildId: giveaway.guildId,
        userId: interaction.user.id,
      },
    },
  });

  // Discord limits 5 buttons per ActionRow → split into rows of 5.
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  for (let i = 0; i < members.length; i += 5) {
    const row = new ActionRowBuilder<ButtonBuilder>();
    for (const m of members.slice(i, i + 5)) {
      const btn = new ButtonBuilder()
        .setCustomId(`gw:pickmain:${giveaway.id}:${mode}:${m.id}`)
        .setLabel(m.name)
        .setStyle(
          currentMain?.memberId === m.id
            ? ButtonStyle.Success
            : ButtonStyle.Primary,
        );
      if (m.emoji) {
        try {
          btn.setEmoji(m.emoji);
        } catch {
          /* invalid emoji string — silently skip */
        }
      }
      row.addComponents(btn);
    }
    rows.push(row);
  }

  await interaction.reply({
    content: renderLabel(
      mode === "e"
        ? "เลือกเมนของคุณใหม่ (กดเมนเดิมก็ได้เพื่อเปลี่ยนแค่ช่องทางติดต่อ) — โชคดี {signals}!"
        : "เลือกเมนของคุณ — โชคดี {signals}!",
      b,
    ),
    components: rows,
    flags: MessageFlags.Ephemeral,
  });
}

async function safeReply(
  interaction: import("discord.js").ButtonInteraction,
  content: string,
): Promise<void> {
  await interaction
    .reply({ content, flags: MessageFlags.Ephemeral })
    .catch((err) => logger.warn({ err }, "safe reply failed"));
}
