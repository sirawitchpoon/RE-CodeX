// One-shot CLI: insert sample giveaways + entries so the backoffice has
// something to render before real Discord activity flows in.
//
// Usage (host shell, from repo root):
//   GUILD_ID=<your-guild-id> \
//     npm --workspace @recodex/db-app run seed:sample
//
// Idempotent: clears `sample_*` giveaways before inserting fresh ones.

import { PrismaClient, GiveawayPlatform, GiveawayStatus } from "../src/_prisma/index.js";

const prisma = new PrismaClient();

const SAMPLES = [
  {
    id: "sample_live",
    title: "Birthday Pack — REI",
    prize: "Limited Cheki Set ×3",
    description: "ฉลองวันเกิด REI · กรอก modal เพื่อเข้าร่วม",
    status: "LIVE" as GiveawayStatus,
    minLevel: 5,
    winnersCount: 3,
    endsInDays: 2,
    entries: [
      ["100000000000000001", "kazuki_v",   "Kazuki Asahina", "TWITTER" as GiveawayPlatform],
      ["100000000000000002", "hibiki_92",  "Hibiki",          "TWITTER" as GiveawayPlatform],
      ["100000000000000003", "aoi_v",      "Aoi Mitsurugi",  "BLUESKY" as GiveawayPlatform],
      ["100000000000000004", "ren_codex",  "Ren",             "TWITTER" as GiveawayPlatform],
      ["100000000000000005", "suki_dev",   "Suki",            "TWITTER" as GiveawayPlatform],
      ["100000000000000006", "yumeno_x",   "Yumeno",          "TWITTER" as GiveawayPlatform],
      ["100000000000000007", "shiki_fan",  "Shiki",           "BLUESKY" as GiveawayPlatform],
      ["100000000000000008", "code_mochi", "Mochi",           "TWITTER" as GiveawayPlatform],
    ],
  },
  {
    id: "sample_scheduled",
    title: "Anniversary Voice Pack",
    prize: "Signed voice clip",
    description: "ฉลอง 1 ปีของวง — เริ่มสัปดาห์หน้า",
    status: "SCHEDULED" as GiveawayStatus,
    minLevel: 10,
    winnersCount: 5,
    endsInDays: 7,
    entries: [],
  },
  {
    id: "sample_ended",
    title: "DEBUT Album Drop",
    prize: "Physical album ×10",
    description: "Giveaway ของรอบเปิดตัว — จบไปแล้ว",
    status: "ENDED" as GiveawayStatus,
    minLevel: 1,
    winnersCount: 10,
    endsInDays: -3,
    entries: [],
  },
];

async function main() {
  const guildId = process.env.GUILD_ID;
  if (!guildId) {
    console.error("[seed-sample] GUILD_ID is required");
    process.exit(1);
  }

  for (const s of SAMPLES) {
    await prisma.giveawayEntry.deleteMany({ where: { giveawayId: s.id } });
    await prisma.giveaway.deleteMany({ where: { id: s.id } });

    await prisma.giveaway.create({
      data: {
        id: s.id,
        guildId,
        channelId: "0",
        title: s.title,
        prize: s.prize,
        description: s.description,
        status: s.status,
        minLevel: s.minLevel,
        winnersCount: s.winnersCount,
        endsAt: new Date(Date.now() + s.endsInDays * 24 * 60 * 60 * 1000),
      },
    });

    for (const [userId, handle, displayName, platform] of s.entries) {
      await prisma.giveawayEntry.create({
        data: {
          giveawayId: s.id,
          userId,
          displayName,
          handle,
          platform,
        },
      });
    }

    console.log(`[seed-sample] ${s.id} (${s.status}) — ${s.entries.length} entries`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
