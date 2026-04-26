import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const guildId = process.env.GUILD_ID;
  const guildName = process.env.GUILD_NAME ?? "Re:CodeX";

  if (!guildId) {
    console.warn(
      "[seed] GUILD_ID not set — skipping default guild seed. Run again with GUILD_ID=<discord_guild_id> to create the default guild + LevelConfig + BrandingConfig.",
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

  console.log(`[seed] Seeded guild ${guildId} (${guildName}) with default LevelConfig + BrandingConfig.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
