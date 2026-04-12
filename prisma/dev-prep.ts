import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { reseedAll } from "./seed-core";
import { runImportPipeline } from "../lib/import/run-imports";

const FLAG_PATH = join(__dirname, ".dev-seeded");

const prisma = new PrismaClient();

async function main() {
  if (existsSync(FLAG_PATH)) {
    return;
  }

  const n = await prisma.school.count();
  if (n === 0) {
    console.log("[dev-prep] Fresh database — seeding + importing…");
    process.env.CONFIRM_RESEED = "true";
    await reseedAll(prisma);

    const importsDir = join(process.cwd(), "data", "imports");
    const result = await runImportPipeline(prisma, importsDir);
    console.log("[dev-prep] Import result:", JSON.stringify(result, null, 2));
    console.log("[dev-prep] Done. Starting dev server.");
  }

  writeFileSync(FLAG_PATH, new Date().toISOString());
}

main()
  .catch((e) => {
    console.error("[dev-prep] Failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
