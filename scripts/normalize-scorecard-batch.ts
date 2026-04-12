/**
 * One-off / utility: normalize the first N schools in a scorecard JSON to match
 * `scripts/scorecard-import.ts` (field order, rounding). Validates with Zod afterward.
 *
 * Usage: npx tsx scripts/normalize-scorecard-batch.ts [path] [count]
 * Defaults: data/imports/scorecard_2026-03-29.json 15
 */
import { readFileSync, writeFileSync } from "node:fs";
import { schoolImportEnvelopeSchema } from "../lib/validation/import-envelope";

const path = process.argv[2] ?? "data/imports/scorecard_2026-03-29.json";
const BATCH = Number(process.argv[3] ?? "15") || 15;

function roundMoney(n: number): number {
  return Math.round(n);
}

function roundPct(n: number): number {
  return Math.round(n * 100) / 100;
}

function normalizeSchool(row: Record<string, unknown>, fallbackCollectedAt: string): Record<string, unknown> {
  const out: Record<string, unknown> = {
    name: row.name,
    state: row.state,
    dataCollectedAt: (row.dataCollectedAt as string) ?? fallbackCollectedAt,
  };

  const id = row.scorecardId;
  if (id !== undefined && id !== null) out.scorecardId = Math.round(Number(id));

  if (row.city !== undefined && row.city !== null) out.city = row.city as string;

  if (row.latitude !== undefined && row.latitude !== null) out.latitude = Number(row.latitude);
  if (row.longitude !== undefined && row.longitude !== null) out.longitude = Number(row.longitude);

  if (row.acceptanceRate !== undefined && row.acceptanceRate !== null) {
    out.acceptanceRate = roundPct(Number(row.acceptanceRate));
  }

  if (row.satMid50Low !== undefined && row.satMid50Low !== null) {
    out.satMid50Low = Math.round(Number(row.satMid50Low));
  }
  if (row.satMid50High !== undefined && row.satMid50High !== null) {
    out.satMid50High = Math.round(Number(row.satMid50High));
  }
  if (row.satMathMid50Low !== undefined && row.satMathMid50Low !== null) {
    out.satMathMid50Low = Math.round(Number(row.satMathMid50Low));
  }
  if (row.satMathMid50High !== undefined && row.satMathMid50High !== null) {
    out.satMathMid50High = Math.round(Number(row.satMathMid50High));
  }
  if (row.satEBRWMid50Low !== undefined && row.satEBRWMid50Low !== null) {
    out.satEBRWMid50Low = Math.round(Number(row.satEBRWMid50Low));
  }
  if (row.satEBRWMid50High !== undefined && row.satEBRWMid50High !== null) {
    out.satEBRWMid50High = Math.round(Number(row.satEBRWMid50High));
  }

  if (row.enrollmentSize !== undefined && row.enrollmentSize !== null) {
    out.enrollmentSize = Math.round(Number(row.enrollmentSize));
  }

  if (row.setting !== undefined && row.setting !== null) out.setting = row.setting as string;

  if (row.retentionRate !== undefined && row.retentionRate !== null) {
    out.retentionRate = roundPct(Number(row.retentionRate));
  }
  if (row.gradRate4Year !== undefined && row.gradRate4Year !== null) {
    out.gradRate4Year = roundPct(Number(row.gradRate4Year));
  }

  if (row.studentFacultyRatio !== undefined && row.studentFacultyRatio !== null) {
    out.studentFacultyRatio = Number(row.studentFacultyRatio);
  }

  if (row.publishedCOA !== undefined && row.publishedCOA !== null) {
    out.publishedCOA = roundMoney(Number(row.publishedCOA));
  }
  if (row.averageAnnualCost !== undefined && row.averageAnnualCost !== null) {
    out.averageAnnualCost = roundMoney(Number(row.averageAnnualCost));
  }
  if (row.tuition !== undefined && row.tuition !== null) {
    out.tuition = roundMoney(Number(row.tuition));
  }
  if (row.roomAndBoard !== undefined && row.roomAndBoard !== null) {
    out.roomAndBoard = roundMoney(Number(row.roomAndBoard));
  }
  if (row.feesAndOther !== undefined && row.feesAndOther !== null) {
    out.feesAndOther = roundMoney(Number(row.feesAndOther));
  }

  return out;
}

const env = JSON.parse(readFileSync(path, "utf8")) as {
  source: string;
  collectedAt: string;
  schools: Record<string, unknown>[];
};

const normalizedHead = env.schools.slice(0, BATCH).map((s) => normalizeSchool(s, env.collectedAt));
const next = {
  ...env,
  schools: [...normalizedHead, ...env.schools.slice(BATCH)],
};

const parsed = schoolImportEnvelopeSchema.safeParse(next);
if (!parsed.success) {
  console.error(parsed.error.flatten());
  process.exit(1);
}

writeFileSync(path, `${JSON.stringify(next, null, 2)}\n`, "utf8");
console.log(`Normalized first ${BATCH} schools in ${path}`);
