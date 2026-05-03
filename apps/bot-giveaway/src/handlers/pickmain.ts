// Multi-step entry flow.
//
//   gw:pickmain:<gid>:<mode>:<memberId>           (button) → Step 2
//   gw:contact:<gid>:<mode>:<memberId>:discord    (button) → commit (Discord)
//   gw:contact:<gid>:<mode>:<memberId>:other      (button) → showModal
//   gw:contactmodal:<gid>:<mode>:<memberId>       (modal) → commit (Other)
//
// State (giveawayId, mode, memberId, eventually contactValue) lives entirely
// in customIds — Discord interactions don't share server-side state across
// clicks. The commit step (Discord OR modal-submit) is the only place that
// writes UserMain, swaps the Discord role, and creates/updates the entry.

import {
  type Client,
  type Interaction,
  type ButtonInteraction,
  type ModalSubmitInteraction,
  type GuildMember,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
} from "discord.js";
import { appPrisma } from "@recodex/db-app";
import { pointsPrisma, type GiveawayMember } from "@recodex/db-points";
import { CHANNELS, encodeEvent } from "@recodex/shared";
import { pub } from "../redis.js";
import { logger } from "../logger.js";
import { findMember } from "../membersCache.js";

type Mode = "n" | "e";
type ContactType = "DISCORD" | "OTHER";

const PICK_PREFIX = "gw:pickmain:";
const CONTACT_PREFIX = "gw:contact:";
const CONTACTMODAL_PREFIX = "gw:contactmodal:";

export function registerPickMainHandler(client: Client): void {
  client.on("interactionCreate", async (interaction: Interaction) => {
    try {
      if (interaction.isButton()) {
        if (interaction.customId.startsWith(PICK_PREFIX)) {
          await handlePick(interaction);
        } else if (interaction.customId.startsWith(CONTACT_PREFIX)) {
          await handleContact(interaction);
        }
      } else if (
        interaction.isModalSubmit() &&
        interaction.customId.startsWith(CONTACTMODAL_PREFIX)
      ) {
        await handleContactModal(interaction);
      }
    } catch (err) {
      logger.error({ err, customId: (interaction as { customId?: string }).customId }, "pickmain handler error");
    }
  });
}

// ─── Step 1 → Step 2 ──────────────────────────────────────────────────────

async function handlePick(interaction: ButtonInteraction): Promise<void> {
  const rest = interaction.customId.slice(PICK_PREFIX.length);
  // <gid>:<mode>:<memberId> — gid is a cuid (no colons), mode is one char,
  // memberId is a cuid (no colons). Splitting on ':' with limit 3 is safe.
  const parts = rest.split(":");
  if (parts.length < 3) return;
  const giveawayId = parts[0]!;
  const mode = parts[1] as Mode;
  const memberId = parts.slice(2).join(":");

  const ctx = await loadContext(interaction, giveawayId, memberId);
  if (!ctx) return;

  await interaction.update({
    content: `เมน: **${ctx.member.name}** · สะดวกติดต่อทาง Discord มั้ย?`,
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`gw:contact:${giveawayId}:${mode}:${memberId}:discord`)
          .setLabel("Discord ได้เลย")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`gw:contact:${giveawayId}:${mode}:${memberId}:other`)
          .setLabel("ช่องทางอื่น")
          .setStyle(ButtonStyle.Secondary),
      ),
    ],
  });
}

// ─── Step 2 button — branch into commit (Discord) or modal (Other) ───────

async function handleContact(interaction: ButtonInteraction): Promise<void> {
  const rest = interaction.customId.slice(CONTACT_PREFIX.length);
  const parts = rest.split(":");
  if (parts.length < 4) return;
  const giveawayId = parts[0]!;
  const mode = parts[1] as Mode;
  const choice = parts[parts.length - 1] as "discord" | "other";
  const memberId = parts.slice(2, parts.length - 1).join(":");

  if (choice === "other") {
    const modal = new ModalBuilder()
      .setCustomId(`gw:contactmodal:${giveawayId}:${mode}:${memberId}`)
      .setTitle("ช่องทางติดต่อของคุณ");

    const input = new TextInputBuilder()
      .setCustomId("contactInput")
      .setLabel("ช่องทางติดต่อ")
      .setPlaceholder("@RLanz_Tn (Twitter)")
      .setStyle(TextInputStyle.Short)
      .setMinLength(1)
      .setMaxLength(100)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(input),
    );

    try {
      await interaction.showModal(modal);
    } catch (err) {
      logger.warn({ err }, "showModal failed");
    }
    return;
  }

  // choice === "discord" → commit straight through
  const ctx = await loadContext(interaction, giveawayId, memberId);
  if (!ctx) return;

  const result = await commitEntry({
    giveaway: ctx.giveaway,
    member: ctx.member,
    member_: ctx.guildMember,
    userId: interaction.user.id,
    mode,
    contactType: "DISCORD",
    contactValue: null,
  });
  if (!result.ok) {
    await interaction
      .update({ content: result.message, components: [] })
      .catch(() => null);
    return;
  }

  await interaction
    .update({ content: result.message, components: [] })
    .catch((err) => logger.warn({ err }, "discord-confirm update failed"));
}

// ─── Step 3 modal submit ─────────────────────────────────────────────────

async function handleContactModal(
  interaction: ModalSubmitInteraction,
): Promise<void> {
  const rest = interaction.customId.slice(CONTACTMODAL_PREFIX.length);
  const parts = rest.split(":");
  if (parts.length < 3) return;
  const giveawayId = parts[0]!;
  const mode = parts[1] as Mode;
  const memberId = parts.slice(2).join(":");

  const value = interaction.fields
    .getTextInputValue("contactInput")
    .trim();
  if (!value) {
    await interaction
      .reply({
        content: "❌ กรุณาระบุช่องทางติดต่อ",
        flags: MessageFlags.Ephemeral,
      })
      .catch(() => null);
    return;
  }

  const ctx = await loadContext(interaction, giveawayId, memberId);
  if (!ctx) return;

  const result = await commitEntry({
    giveaway: ctx.giveaway,
    member: ctx.member,
    member_: ctx.guildMember,
    userId: interaction.user.id,
    mode,
    contactType: "OTHER",
    contactValue: value,
  });

  await interaction
    .reply({ content: result.message, flags: MessageFlags.Ephemeral })
    .catch((err) => logger.warn({ err }, "modal reply failed"));
}

// ─── Shared helpers ──────────────────────────────────────────────────────

type GiveawayRow = NonNullable<Awaited<ReturnType<typeof appPrisma.giveaway.findUnique>>>;

async function loadContext(
  interaction: ButtonInteraction | ModalSubmitInteraction,
  giveawayId: string,
  memberId: string,
): Promise<{ giveaway: GiveawayRow; member: GiveawayMember; guildMember: GuildMember | null } | null> {
  const giveaway = await appPrisma.giveaway.findUnique({
    where: { id: giveawayId },
  });
  if (!giveaway) {
    await replyEphemeral(interaction, "❌ Giveaway นี้ไม่มีอยู่แล้ว");
    return null;
  }
  if (giveaway.status !== "LIVE") {
    await replyEphemeral(interaction, "❌ Giveaway นี้ปิดรับสมัครแล้ว");
    return null;
  }

  const member = await findMember(giveaway.guildId, memberId);
  if (!member) {
    await replyEphemeral(interaction, "❌ เมนนี้ไม่พร้อมใช้งาน — แจ้งทีมงาน");
    return null;
  }

  const guildMember = (interaction.member as GuildMember | null) ?? null;
  return { giveaway, member, guildMember };
}

interface CommitInput {
  giveaway: GiveawayRow;
  member: GiveawayMember;
  member_: GuildMember | null;
  userId: string;
  mode: Mode;
  contactType: ContactType;
  contactValue: string | null;
}

async function commitEntry(
  input: CommitInput,
): Promise<{ ok: boolean; message: string }> {
  const { giveaway, member, member_, userId, mode, contactType, contactValue } =
    input;

  // 1. Role swap (idempotent). Failure logs a warning but doesn't block the
  //    entry — the user still gets to participate; admin can fix the role
  //    hierarchy after the fact.
  if (member_) {
    const existingMain = await pointsPrisma.userMain.findUnique({
      where: { guildId_userId: { guildId: giveaway.guildId, userId } },
      include: { member: true },
    });
    if (existingMain && existingMain.memberId !== member.id) {
      await member_.roles
        .remove(existingMain.member.roleId, "Giveaway main change")
        .catch((err) =>
          logger.warn(
            { err, oldRoleId: existingMain.member.roleId, userId },
            "remove old main role failed",
          ),
        );
    }
    const hadMissingPerm = await member_.roles
      .add(member.roleId, `Giveaway main: ${member.name}`)
      .then(() => false)
      .catch((err) => {
        logger.warn(
          { err, roleId: member.roleId, userId },
          "add main role failed",
        );
        return true;
      });
    if (hadMissingPerm) {
      // Continue — bot may lack Manage Roles or hierarchy. Surface as a hint
      // in the reply but still record the entry.
      logger.warn(
        { guildId: giveaway.guildId, userId, roleId: member.roleId },
        "role grant skipped — entry will still be recorded",
      );
    }
  }

  // 2. Persist UserMain (points-db) so subsequent giveaways see the choice.
  await pointsPrisma.userMain.upsert({
    where: { guildId_userId: { guildId: giveaway.guildId, userId } },
    create: {
      guildId: giveaway.guildId,
      userId,
      memberId: member.id,
    },
    update: { memberId: member.id },
  });

  // 3. Insert / update the GiveawayEntry per mode.
  let entry;
  try {
    if (mode === "n") {
      entry = await appPrisma.giveawayEntry.create({
        data: {
          giveawayId: giveaway.id,
          userId,
          memberId: member.id,
          contactType,
          contactValue,
        },
      });
    } else {
      entry = await appPrisma.giveawayEntry.update({
        where: {
          giveawayId_userId: { giveawayId: giveaway.id, userId },
        },
        data: { memberId: member.id, contactType, contactValue },
      });
    }
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (mode === "n" && code === "P2002") {
      return {
        ok: false,
        message: "⚠️ คุณเคยสมัคร Giveaway นี้ไปแล้ว — ใช้ **แก้ไขข้อมูล** แทน",
      };
    }
    if (mode === "e" && code === "P2025") {
      return {
        ok: false,
        message: "❌ ไม่พบ entry เดิม — ลองกด **เข้าร่วม** อีกครั้ง",
      };
    }
    logger.error({ err, giveawayId: giveaway.id, userId }, "commit entry failed");
    return { ok: false, message: "❌ เกิดข้อผิดพลาด ลองอีกครั้งหรือแจ้งทีมงาน" };
  }

  // 4. Publish + log (best-effort; failures don't roll back the DB write).
  await pub
    .publish(
      CHANNELS.GIVEAWAY_ENTRY,
      encodeEvent(CHANNELS.GIVEAWAY_ENTRY, {
        giveawayId: giveaway.id,
        userId,
        memberId: member.id,
        memberName: member.name,
        contactType,
        contactValue,
        createdAt: entry.createdAt.toISOString(),
      }),
    )
    .catch((err) => logger.warn({ err }, "entry publish failed"));

  await appPrisma.log
    .create({
      data: {
        guildId: giveaway.guildId,
        level: "EVENT",
        source: "RX.Giveaway",
        event: mode === "n" ? "entry.created" : "entry.updated",
        message: `${mode === "n" ? "joined" : "updated"} "${giveaway.title}" as main of ${member.name}`,
        meta: { giveawayId: giveaway.id, userId, memberId: member.id, contactType },
      },
    })
    .catch(() => null);

  const verb = mode === "n" ? "เข้าร่วมเรียบร้อย" : "อัปเดตข้อมูลแล้ว";
  const tail =
    contactType === "DISCORD"
      ? "ติดต่อทาง Discord"
      : `ติดต่อ: ${contactValue}`;
  return { ok: true, message: `✅ ${verb} — เมน **${member.name}** · ${tail}` };
}

async function replyEphemeral(
  interaction: ButtonInteraction | ModalSubmitInteraction,
  content: string,
): Promise<void> {
  await interaction
    .reply({ content, flags: MessageFlags.Ephemeral })
    .catch((err) => logger.warn({ err }, "reply failed"));
}
