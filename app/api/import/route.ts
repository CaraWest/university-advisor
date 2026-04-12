import { join } from "node:path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { runImportPipeline } from "@/lib/import/run-imports";

export const dynamic = "force-dynamic";

/**
 * Processes all import files in `data/imports/` by source prefix.
 * Apply order: school_research -> financial -> swimcloud -> scorecard.
 */
export async function POST() {
  const importsDir = join(process.cwd(), "data", "imports");
  const result = await runImportPipeline(prisma, importsDir);
  return NextResponse.json(result);
}
