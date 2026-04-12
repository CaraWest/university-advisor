/**
 * Same as POST /api/import — merges JSON files under data/imports/ using lib/import/run-imports.ts.
 */
import { join } from "node:path";

import { prisma } from "../lib/db";
import { runImportPipeline } from "../lib/import/run-imports";

async function main() {
  const importsDir = join(process.cwd(), "data", "imports");
  const result = await runImportPipeline(prisma, importsDir);
  console.log(JSON.stringify(result, null, 2));
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
