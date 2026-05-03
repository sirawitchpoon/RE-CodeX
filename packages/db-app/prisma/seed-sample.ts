// One-shot CLI: insert sample giveaways so the backoffice has something to
// render before real Discord activity flows in. Entries are no longer seeded
// here because GiveawayEntry now soft-FKs into points-db.GiveawayMember,
// which the admin populates via the Giveaway → Members admin page. Run the
// real flow in Discord (or write a custom seeder) to get sample entries.
//
// Usage (host shell, from repo root):
//   GUILD_ID=<your-guild-id> \
//     npm --workspace @recodex/db-app run seed:sample
//
// Idempotent: clears `sample_*` giveaways before inserting fresh ones.

import { PrismaClient, GiveawayStatus } from "../src/_prisma/index.js";

const prisma = new PrismaClient();

const SAMPLES = [
  {
    id: "sample_live",
    title: "Birthday Pack — REI",
    prize: "Limited Cheki Set ×3",
    description: "ฉลองวันเกิด REI · กดปุ่มเข้าร่วมแล้วเลือกเมน",
    status: "LIVE" as GiveawayStatus,
    minLevel: 5,
    winnersCount: 3,
    endsInDays: 2,
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

    console.log(`[seed-sample] ${s.id} (${s.status})`);
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
