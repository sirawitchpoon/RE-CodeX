// One-shot CLI: create or rotate the password for an AdminUser.
//
// Usage (host shell):
//   ADMIN_USERNAME=admin ADMIN_PASSWORD='change-me' \
//     npm --workspace @recodex/db-app run seed:admin
//
// Inside the migrate-app container we don't auto-run this — admins are
// created explicitly so a misconfigured rebuild can't silently rotate the
// password.

import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/_prisma/index.js";

const prisma = new PrismaClient();

async function main() {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) {
    console.error("[seed-admin] ADMIN_USERNAME and ADMIN_PASSWORD must be set");
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("[seed-admin] password must be at least 8 characters");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.adminUser.upsert({
    where: { username },
    update: { passwordHash },
    create: { username, passwordHash },
  });
  console.log(`[seed-admin] upserted admin ${user.username} (${user.id})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
