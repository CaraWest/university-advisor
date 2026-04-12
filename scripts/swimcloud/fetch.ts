/**
 * Scrape SwimCloud how-do-i-fit for targets from:
 * - `SWIMCLOUD_TARGETS_SOURCE=file` or existing data/swimcloud-targets.json (auto): JSON { teamId, name }[]
 * - `SWIMCLOUD_TARGETS_SOURCE=db` or auto when no file: School with scorecardId + SwimData.swimcloudTeamId + not notInSwimCloud
 *
 * Writes data/imports/swimcloud_YYYY-MM-DD_scrape.json (rows include scorecardId when known).
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { PrismaClient } from "@prisma/client";
import { chromium } from "playwright";

import {
  type SwimcloudSchoolRow,
  swimcloudRowHasFitMetrics,
} from "@/lib/import/swimcloud-row-metrics";

import { swimcloudChromiumLaunchHints } from "./chromium-launch";
import { parseHowDoIFitPage } from "./parse-fit";
import {
  swimcloudStorageStatePath,
  swimcloudTargetsPath,
  swimcloudTargetsSource,
} from "./paths";
import { waitForFitPageMarkers } from "./wait-for-fit-ui";

const DELAY_MS = Math.max(0, parseInt(process.env.SWIMCLOUD_FETCH_DELAY_MS ?? "3000", 10) || 3000);

interface Target {
  teamId: number;
  name: string;
  scorecardId?: number;
}

function useChromeChannel(): boolean {
  return process.env.SWIMCLOUD_PLAYWRIGHT_CHANNEL !== "chromium";
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

async function loadTargetsFromFile(path: string): Promise<Target[]> {
  const raw: unknown = JSON.parse(await readFile(path, "utf8"));
  if (!Array.isArray(raw)) {
    throw new Error("targets must be a JSON array of { teamId, name }");
  }
  return raw.map((row, i) => {
    if (row === null || typeof row !== "object") {
      throw new Error(`targets[${i}] must be an object`);
    }
    const rec = row as { teamId?: unknown; name?: unknown; scorecardId?: unknown };
    const teamId = Number(rec.teamId);
    const name = String(rec.name ?? "").trim();
    if (!Number.isInteger(teamId) || teamId <= 0) {
      throw new Error(`targets[${i}].teamId must be a positive integer`);
    }
    if (!name) {
      throw new Error(`targets[${i}].name is required`);
    }
    const out: Target = { teamId, name };
    if (rec.scorecardId != null) {
      const sid = Number(rec.scorecardId);
      if (Number.isInteger(sid) && sid > 0) out.scorecardId = sid;
    }
    return out;
  });
}

async function loadTargetsFromDb(prisma: PrismaClient): Promise<Target[]> {
  const schools = await prisma.school.findMany({
    where: {
      scorecardId: { not: null },
      swimData: {
        is: {
          swimcloudTeamId: { not: null },
          notInSwimCloud: false,
        },
      },
    },
    select: {
      name: true,
      scorecardId: true,
      swimData: { select: { swimcloudTeamId: true } },
    },
    orderBy: { name: "asc" },
  });
  const targets: Target[] = [];
  for (const s of schools) {
    const tid = s.swimData?.swimcloudTeamId;
    const sid = s.scorecardId;
    if (tid == null || sid == null) continue;
    targets.push({ teamId: tid, name: s.name, scorecardId: sid });
  }
  return targets;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const storagePath = swimcloudStorageStatePath();
  if (!existsSync(storagePath)) {
    console.error(`No session file at ${storagePath}\nRun: npm run swimcloud:auth\n`);
    process.exit(1);
  }

  const source = swimcloudTargetsSource();
  const targetsPath = swimcloudTargetsPath();
  let targets: Target[];
  let targetsMeta: Record<string, unknown>;

  const { prisma } = await import("@/lib/db");
  let disconnectPrisma = false;
  try {
    if (source === "file") {
      if (!existsSync(targetsPath)) {
        console.error(
          `No targets file at ${targetsPath}\n` +
            "Set SWIMCLOUD_TARGETS_SOURCE=db after swimcloud:map:sync, or create the JSON file.\n",
        );
        process.exit(1);
      }
      targets = await loadTargetsFromFile(targetsPath);
      targetsMeta = { source: "file", path: targetsPath };
    } else {
      targets = await loadTargetsFromDb(prisma);
      disconnectPrisma = true;
      targetsMeta = { source: "db", schoolCount: targets.length };
      if (targets.length === 0) {
        console.error(
          "No DB targets: need School.scorecardId + SwimData.swimcloudTeamId + notInSwimCloud false.\n" +
            "Run: npm run swimcloud:backfill:team-ids, npm run swimcloud:map:sync (and scorecard / import if needed), or use file targets.\n",
        );
        process.exit(1);
      }
      console.log(`Loaded ${targets.length} target(s) from database (map sync + scorecard).\n`);
    }
  } finally {
    if (disconnectPrisma) {
      await prisma.$disconnect().catch(() => {});
    }
  }

  const headed =
    process.env.SWIMCLOUD_FETCH_HEADED === "1" || process.env.SWIMCLOUD_FETCH_HEADED === "true";

  const launchOpts: Parameters<typeof chromium.launch>[0] = {
    headless: !headed,
    ...swimcloudChromiumLaunchHints(),
  };
  if (useChromeChannel()) {
    launchOpts.channel = "chrome";
  }

  const browser = await chromium.launch(launchOpts);
  const context = await browser.newContext({
    storageState: storagePath,
    viewport: { width: 1280, height: 720 },
    locale: "en-US",
  });
  const page = await context.newPage();

  const schools: Record<string, unknown>[] = [];
  const errors: { teamId: number; name: string; error: string }[] = [];
  let thinParseWarnings = 0;

  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    const url = `https://www.swimcloud.com/team/${t.teamId}/how-do-i-fit/`;
    console.log(`[${i + 1}/${targets.length}] ${t.name} (${t.teamId})`);
    try {
      await page.goto(url, { waitUntil: "load", timeout: 90_000 });
      await waitForFitPageMarkers(page);
      const finalUrl = page.url();
      if (/\/login\/?/i.test(finalUrl)) {
        throw new Error("redirected to login — run npm run swimcloud:auth");
      }
      const row = await parseHowDoIFitPage(page, t.teamId, t.name);
      if (t.scorecardId != null) {
        row.scorecardId = t.scorecardId;
      }
      if (!swimcloudRowHasFitMetrics(row as SwimcloudSchoolRow)) {
        thinParseWarnings += 1;
        console.warn(
          `  warn: no fit metrics (match/PI/roster/rank) — headless often fails here. Try: SWIMCLOUD_FETCH_HEADED=1 npm run swimcloud:fetch`,
        );
      }
      schools.push(row);
    } catch (e) {
      const msg = String(e);
      errors.push({ teamId: t.teamId, name: t.name, error: msg });
      console.error(`  error: ${msg}`);
    }
    if (i < targets.length - 1 && DELAY_MS > 0) {
      await sleep(DELAY_MS);
    }
  }

  await browser.close();

  const collectedAt = new Date().toISOString();
  const envelope = {
    source: "swimcloud" as const,
    collectedAt,
    stats: {
      ...targetsMeta,
      teamsRequested: targets.length,
      teamsParsed: schools.length,
      delayMsBetweenTeams: DELAY_MS,
      headed: headed,
      teamsWithoutFitMetrics: thinParseWarnings,
      ...(errors.length > 0 ? { errors } : {}),
    },
    schools,
  };

  const importsDir = join(process.cwd(), "data", "imports");
  await mkdir(importsDir, { recursive: true });
  const outName = `swimcloud_${todayIsoDate()}_scrape.json`;
  const outPath = join(importsDir, outName);
  await writeFile(`${outPath}`, JSON.stringify(envelope, null, 2) + "\n", "utf8");
  console.log(`Wrote ${outPath} (${schools.length}/${targets.length} schools)`);
  if (errors.length > 0) {
    console.error(`\n${errors.length} team(s) failed — see stats.errors in the JSON.`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
