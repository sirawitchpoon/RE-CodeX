import { PrismaClient } from ".prisma/points-client";

const prisma = new PrismaClient();

async function main() {
  const guildId = process.env.GUILD_ID;
  const guildName = process.env.GUILD_NAME ?? "Re:CodeX";

  if (!guildId) {
    console.warn(
      "[points seed] GUILD_ID not set — skipping. Set GUILD_ID to bootstrap default Guild + LevelConfig + BrandingConfig.",
    );
    return;
  }

  await prisma.guild.upsert({
    where: { id: guildId },
    update: { name: guildName },
    create: { id: guildId, name: guildName },
  });

  await prisma.levelConfig.upsert({
    where: { guildId },
    update: {},
    create: { guildId },
  });

  await prisma.brandingConfig.upsert({
    where: { guildId },
    update: {},
    create: { guildId },
  });

  console.log(`[points seed] Seeded guild ${guildId} (${guildName}).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
