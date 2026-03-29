import { PrismaClient } from "@prisma/client";
import { reseedAll } from "./seed-core";

const prisma = new PrismaClient();

reseedAll(prisma)
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
