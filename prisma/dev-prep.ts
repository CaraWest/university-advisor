import { PrismaClient } from "@prisma/client";
import { reseedAll } from "./seed-core";

/**
 * Runs before `next dev`. If there are no schools yet, performs a full reseed
 * so `npm run dev` is enough after a fresh clone (after `npm install` + `.env`).
 */
const prisma = new PrismaClient();

async function main() {
  const n = await prisma.school.count();
  if (n === 0) {
    console.log("[dev-prep] No schools in the database — seeding…");
    await reseedAll(prisma);
    console.log("[dev-prep] Done. Starting dev server.");
  }
}

main()
  .catch((e) => {
    console.error("[dev-prep] Failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
