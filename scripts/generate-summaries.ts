/**
 * Batch AI executive summary generation. Calls the Anthropic API directly
 * (no running dev server required).
 *
 * Usage:
 *   npx tsx scripts/generate-summaries.ts            # schools with no summary
 *   npx tsx scripts/generate-summaries.ts --all       # regenerate every school
 *   npx tsx scripts/generate-summaries.ts --school "Duke University"
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { buildSummaryInstruction, contextJsonForPrompt } from "../lib/ai/school-summary-context";
import { completeExecutiveSummary } from "../lib/ai/call-anthropic";

function loadDotenvFromCwd(): void {
  const envPath = join(process.cwd(), ".env");
  if (!existsSync(envPath)) return;
  const text = readFileSync(envPath, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

const schoolInclude = {
  swimData: true,
  academicProfile: true,
} as const;

async function main(): Promise<void> {
  loadDotenvFromCwd();

  if (!process.env.ANTHROPIC_API_KEY?.trim()) {
    console.error("ANTHROPIC_API_KEY is not set in .env");
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const allFlag = args.includes("--all");
  const schoolIdx = args.indexOf("--school");
  const schoolName = schoolIdx !== -1 ? args[schoolIdx + 1] : null;

  const prisma = new PrismaClient();

  try {
    let where: Record<string, unknown> = {};
    if (schoolName) {
      where = { name: schoolName };
    } else if (!allFlag) {
      where = { aiSummary: null };
    }

    const [schools, profile] = await Promise.all([
      prisma.school.findMany({
        where,
        include: schoolInclude,
        orderBy: [{ state: "asc" }, { name: "asc" }],
      }),
      prisma.studentProfile.findFirst(),
    ]);

    if (schools.length === 0) {
      if (schoolName) {
        console.log(`No school found matching "${schoolName}".`);
      } else {
        console.log("All schools already have summaries.");
      }
      return;
    }

    const label = allFlag ? "all" : schoolName ? `"${schoolName}"` : "missing summaries";
    console.log(`Found ${schools.length} schools (${label}).`);
    if (profile) {
      console.log(`Using student profile (power index: ${profile.powerIndex ?? "n/a"}).\n`);
    } else {
      console.log("No student profile found — generating without student context.\n");
    }

    const instruction = buildSummaryInstruction(profile);

    let succeeded = 0;
    let failed = 0;

    for (let i = 0; i < schools.length; i++) {
      const school = schools[i];
      const progress = `[${i + 1}/${schools.length}]`;

      try {
        const jsonBlock = contextJsonForPrompt(school, school.swimData, school.academicProfile, profile);
        const userMessage = `${instruction}\n\n---\nSchool facts (JSON):\n${jsonBlock}`;

        const summary = await completeExecutiveSummary(userMessage);

        await prisma.school.update({
          where: { id: school.id },
          data: { aiSummary: summary, summaryGeneratedAt: new Date() },
        });

        console.log(`${progress} ✓ ${school.name} (${school.state})`);
        succeeded++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`${progress} ✗ ${school.name} (${school.state}) — ${msg}`);
        failed++;
      }

      if (i < schools.length - 1) await sleep(5000);
    }

    console.log(
      `\n=== Done: ${succeeded} succeeded, ${failed} failed, ${schools.length} total ===`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
