/**
 * Bulk enrichment: queries all schools where enrichmentComplete = false
 * and calls POST /api/enrich/[schoolId] for each with a delay between calls.
 *
 * Requires a running dev server at NEXTAUTH_URL (default http://localhost:3000).
 *
 * Usage:
 *   npx tsx scripts/enrich-all.ts              # full enrichment
 *   npx tsx scripts/enrich-all.ts --claude-only # skip Scorecard (re-run Claude only)
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

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

async function main(): Promise<void> {
  loadDotenvFromCwd();

  const claudeOnly = process.argv.includes("--claude-only");

  const baseUrl = (
    process.env.NEXTAUTH_URL || "http://localhost:3000"
  ).replace(/\/$/, "");

  const prisma = new PrismaClient();
  const schools = await prisma.school.findMany({
    where: { enrichmentComplete: false },
    select: { id: true, name: true, state: true },
    orderBy: [{ state: "asc" }, { name: "asc" }],
  });
  await prisma.$disconnect();

  if (schools.length === 0) {
    console.log("All schools are already enriched.");
    return;
  }

  console.log(`Found ${schools.length} unenriched schools.${claudeOnly ? " (Claude-only mode)" : ""}\n`);

  let succeeded = 0;
  let failed = 0;

  for (let i = 0; i < schools.length; i++) {
    const school = schools[i];
    const progress = `[${i + 1}/${schools.length}]`;

    try {
      const params = new URLSearchParams({ skipSummary: "true" });
      if (claudeOnly) params.set("skipScorecard", "true");
      const res = await fetch(`${baseUrl}/api/enrich/${school.id}?${params}`, {
        method: "POST",
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error(
          `${progress} ✗ ${school.name} (${school.state}) — HTTP ${res.status}: ${text.slice(0, 200)}`,
        );
        failed++;
      } else {
        const data = (await res.json()) as {
          scorecard?: { ok: boolean; error?: string };
          claude?: { ok: boolean; error?: string };
          summary?: { ok: boolean; error?: string };
          enrichmentComplete: boolean;
        };
        const sc = data.scorecard ? (data.scorecard.ok ? "✓" : `✗ ${data.scorecard.error}`) : "–";
        const cl = data.claude ? (data.claude.ok ? "✓" : `✗ ${data.claude.error}`) : "–";
        const sm = data.summary ? (data.summary.ok ? "✓" : `✗ ${data.summary.error}`) : "–";
        const done = data.enrichmentComplete ? "✓" : "✗";
        console.log(
          `${progress} ${school.name} (${school.state}) — Scorecard: ${sc} | Claude: ${cl} | Summary: ${sm} | Complete: ${done}`,
        );
        if (data.enrichmentComplete) succeeded++;
        else failed++;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(
        `${progress} ✗ ${school.name} (${school.state}) — ${msg}`,
      );
      failed++;
    }

    if (i < schools.length - 1) await sleep(5000);
  }

  console.log(
    `\n=== Done: ${succeeded} succeeded, ${failed} failed, ${schools.length} total ===`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
