/**
 * Fetches College Scorecard data for each School row and writes
 * data/imports/scorecard_YYYY-MM-DD.json (import envelope, source "scorecard").
 *
 * Requires SCORECARD_API_KEY and DATABASE_URL (e.g. from .env in project root).
 */
import { mkdirSync, readFileSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import {
  scorecardMatchLabels,
  scorecardSearchQuerySequence,
} from "@/lib/import/scorecard-institution-overrides";
import { normalizeForScorecardMatch } from "@/lib/import/scorecard-name-match";

const SCORECARD_BASE = "https://api.data.gov/ed/collegescorecard/v1/schools.json";

const REQUEST_FIELDS = [
  "id",
  "school.name",
  "school.city",
  "school.state",
  "school.locale",
  "location.lat",
  "location.lon",
  "latest.admissions.admission_rate.overall",
  "latest.admissions.sat_scores.25th_percentile.math",
  "latest.admissions.sat_scores.25th_percentile.critical_reading",
  "latest.admissions.sat_scores.75th_percentile.math",
  "latest.admissions.sat_scores.75th_percentile.critical_reading",
  "latest.student.size",
  "latest.student.retention_rate.four_year.full_time",
  "latest.completion.completion_rate_4yr_150nt",
  "latest.student.student_faculty_ratio",
  "latest.cost.attendance.academic_year",
  "latest.cost.tuition.in_state",
  "latest.cost.tuition.out_of_state",
  "latest.cost.roomboard.oncampus",
  "latest.cost.roomboard.offcampus",
  "latest.cost.roomboard.withfamily",
  "latest.cost.booksupply",
  "latest.cost.otherexpense.oncampus",
  "latest.cost.otherexpense.offcampus",
  "latest.cost.otherexpense.withfamily",
].join(",");

const LOCALE_LABELS: Record<number, string> = {
  11: "Large city",
  12: "Midsize city",
  13: "Small city",
  21: "Large suburb",
  22: "Midsize suburb",
  23: "Small suburb",
  31: "Fringe town",
  32: "Distant town",
  33: "Remote town",
  41: "Fringe rural",
  42: "Distant rural",
  43: "Remote rural",
};

const PRISMA_FIELDS_TRACKED = [
  "scorecardId",
  "city",
  "latitude",
  "longitude",
  "acceptanceRate",
  "satMid50Low",
  "satMid50High",
  "satMathMid50Low",
  "satMathMid50High",
  "satEBRWMid50Low",
  "satEBRWMid50High",
  "enrollmentSize",
  "setting",
  "retentionRate",
  "gradRate4Year",
  "studentFacultyRatio",
  "publishedCOA",
  "averageAnnualCost",
  "tuition",
  "roomAndBoard",
  "feesAndOther",
] as const;

type Tracked = (typeof PRISMA_FIELDS_TRACKED)[number];

type ScorecardFlatRow = Record<string, unknown>;

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

function n(r: ScorecardFlatRow, k: string): number | null {
  const v = r[k];
  if (v === null || v === undefined) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return null;
}

function s(r: ScorecardFlatRow, k: string): string | null {
  const v = r[k];
  if (v === null || v === undefined) return null;
  if (typeof v === "string") return v;
  return null;
}

function localeToSetting(locale: number | null): string | null {
  if (locale === null) return null;
  return LOCALE_LABELS[locale] ?? null;
}

function pctFromRate(v: number | null): number | null {
  if (v === null) return null;
  if (v > 1 && v <= 100) return v;
  if (v >= 0 && v <= 1) return v * 100;
  return v * 100;
}

function satCombined(r: ScorecardFlatRow, which: "25" | "75"): number | null {
  const math =
    n(
      r,
      which === "25"
        ? "latest.admissions.sat_scores.25th_percentile.math"
        : "latest.admissions.sat_scores.75th_percentile.math",
    );
  const read =
    n(
      r,
      which === "25"
        ? "latest.admissions.sat_scores.25th_percentile.critical_reading"
        : "latest.admissions.sat_scores.75th_percentile.critical_reading",
    );
  if (math === null || read === null) return null;
  return Math.round(math + read);
}

function pickTuition(r: ScorecardFlatRow): number | null {
  const ins = n(r, "latest.cost.tuition.in_state");
  const out = n(r, "latest.cost.tuition.out_of_state");
  if (ins !== null && out !== null) return Math.round(Math.max(ins, out));
  return ins !== null ? Math.round(ins) : out !== null ? Math.round(out) : null;
}

function pickRoomBoard(r: ScorecardFlatRow): number | null {
  const on = n(r, "latest.cost.roomboard.oncampus");
  if (on !== null) return Math.round(on);
  const off = n(r, "latest.cost.roomboard.offcampus");
  if (off !== null) return Math.round(off);
  const fam = n(r, "latest.cost.roomboard.withfamily");
  if (fam !== null) return Math.round(fam);
  return null;
}

function pickOtherExpense(r: ScorecardFlatRow): number | null {
  const on = n(r, "latest.cost.otherexpense.oncampus");
  if (on !== null) return Math.round(on);
  const off = n(r, "latest.cost.otherexpense.offcampus");
  if (off !== null) return Math.round(off);
  const fam = n(r, "latest.cost.otherexpense.withfamily");
  if (fam !== null) return Math.round(fam);
  return null;
}

function mapRowToPayload(
  row: ScorecardFlatRow,
  dbState: string,
  collectedAt: string,
): { json: Record<string, unknown>; nullPrismaFields: Tracked[] } {
  const id = n(row, "id");
  const city = s(row, "school.city");
  const lat = n(row, "location.lat");
  const lon = n(row, "location.lon");
  const localeRaw = n(row, "school.locale");
  const locale = localeRaw !== null ? Math.round(localeRaw) : null;
  const acceptanceRaw = n(row, "latest.admissions.admission_rate.overall");
  const acceptanceRate = acceptanceRaw !== null ? pctFromRate(acceptanceRaw) : null;
  const satLow = satCombined(row, "25");
  const satHigh = satCombined(row, "75");
  const satMathLow = n(row, "latest.admissions.sat_scores.25th_percentile.math");
  const satMathHigh = n(row, "latest.admissions.sat_scores.75th_percentile.math");
  const satEBRWLow = n(row, "latest.admissions.sat_scores.25th_percentile.critical_reading");
  const satEBRWHigh = n(row, "latest.admissions.sat_scores.75th_percentile.critical_reading");
  const sizeRaw = n(row, "latest.student.size");
  const enrollmentSize = sizeRaw !== null ? Math.round(sizeRaw) : null;
  const setting = localeToSetting(locale);
  const retRaw = n(row, "latest.student.retention_rate.four_year.full_time");
  const retentionRate = retRaw !== null ? pctFromRate(retRaw) : null;
  const gradRaw = n(row, "latest.completion.completion_rate_4yr_150nt");
  const gradRate4Year = gradRaw !== null ? pctFromRate(gradRaw) : null;
  const sfr = n(row, "latest.student.student_faculty_ratio");
  const publishedCOA = n(row, "latest.cost.attendance.academic_year");
  const averageAnnualCost = n(row, "latest.cost.avg_net_price.overall");
  const tuition = pickTuition(row);
  const roomAndBoard = pickRoomBoard(row);
  const books = n(row, "latest.cost.booksupply");
  const otherExp = pickOtherExpense(row);
  let feesAndOther: number | null = null;
  if (books !== null || otherExp !== null) {
    feesAndOther = Math.round((books ?? 0) + (otherExp ?? 0));
  }

  const json: Record<string, unknown> = {
    name: "", // filled by caller
    state: dbState,
    dataCollectedAt: collectedAt,
  };

  if (id !== null) json.scorecardId = Math.round(id);
  if (city !== null) json.city = city;
  if (lat !== null) json.latitude = lat;
  if (lon !== null) json.longitude = lon;
  if (acceptanceRate !== null) json.acceptanceRate = Math.round(acceptanceRate * 100) / 100;
  if (satLow !== null) json.satMid50Low = satLow;
  if (satHigh !== null) json.satMid50High = satHigh;
  if (satMathLow !== null) json.satMathMid50Low = Math.round(satMathLow);
  if (satMathHigh !== null) json.satMathMid50High = Math.round(satMathHigh);
  if (satEBRWLow !== null) json.satEBRWMid50Low = Math.round(satEBRWLow);
  if (satEBRWHigh !== null) json.satEBRWMid50High = Math.round(satEBRWHigh);
  if (enrollmentSize !== null) json.enrollmentSize = enrollmentSize;
  if (setting !== null) json.setting = setting;
  if (retentionRate !== null) json.retentionRate = Math.round(retentionRate * 100) / 100;
  if (gradRate4Year !== null) json.gradRate4Year = Math.round(gradRate4Year * 100) / 100;
  if (sfr !== null) json.studentFacultyRatio = sfr;
  if (publishedCOA !== null) json.publishedCOA = Math.round(publishedCOA);
  if (tuition !== null) json.tuition = tuition;
  if (roomAndBoard !== null) json.roomAndBoard = roomAndBoard;
  if (feesAndOther !== null) json.feesAndOther = feesAndOther;

  const nullPrismaFields: Tracked[] = [];
  if (id === null) nullPrismaFields.push("scorecardId");
  if (city === null) nullPrismaFields.push("city");
  if (lat === null) nullPrismaFields.push("latitude");
  if (lon === null) nullPrismaFields.push("longitude");
  if (acceptanceRate === null) nullPrismaFields.push("acceptanceRate");
  if (satLow === null) nullPrismaFields.push("satMid50Low");
  if (satHigh === null) nullPrismaFields.push("satMid50High");
  if (satMathLow === null) nullPrismaFields.push("satMathMid50Low");
  if (satMathHigh === null) nullPrismaFields.push("satMathMid50High");
  if (satEBRWLow === null) nullPrismaFields.push("satEBRWMid50Low");
  if (satEBRWHigh === null) nullPrismaFields.push("satEBRWMid50High");
  if (enrollmentSize === null) nullPrismaFields.push("enrollmentSize");
  if (setting === null) nullPrismaFields.push("setting");
  if (retentionRate === null) nullPrismaFields.push("retentionRate");
  if (gradRate4Year === null) nullPrismaFields.push("gradRate4Year");
  if (sfr === null) nullPrismaFields.push("studentFacultyRatio");
  if (publishedCOA === null) nullPrismaFields.push("publishedCOA");
  if (averageAnnualCost === null) nullPrismaFields.push("averageAnnualCost");
  if (tuition === null) nullPrismaFields.push("tuition");
  if (roomAndBoard === null) nullPrismaFields.push("roomAndBoard");
  if (feesAndOther === null) nullPrismaFields.push("feesAndOther");

  return { json, nullPrismaFields };
}

async function scorecardFetch(
  schoolName: string,
  state: string,
  apiKey: string,
): Promise<ScorecardFlatRow[]> {
  const url = new URL(SCORECARD_BASE);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("school.name", schoolName);
  url.searchParams.set("school.state", state);
  url.searchParams.set("fields", REQUEST_FIELDS);
  url.searchParams.set("per_page", "100");

  const maxAttempts = 5;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch(url);
    if (res.status === 429 && attempt < maxAttempts) {
      const retryAfter = Number(res.headers.get("retry-after")) || 5 * attempt;
      console.warn(`[rate_limit] backing off ${retryAfter}s (attempt ${attempt}/${maxAttempts})`);
      await sleep(retryAfter * 1000);
      continue;
    }
    if (!res.ok) {
      throw new Error(`Scorecard HTTP ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as { results?: ScorecardFlatRow[] };
    return data.results ?? [];
  }
  throw new Error("Scorecard: exhausted retries");
}

function filterMatches(rows: ScorecardFlatRow[], dbName: string, dbState: string): ScorecardFlatRow[] {
  const labelNorms = new Set(scorecardMatchLabels(dbName).map((l) => normalizeForScorecardMatch(l)));
  return rows.filter((r) => {
    const st = s(r, "school.state");
    const nm = s(r, "school.name");
    if (!nm || st !== dbState) return false;
    return labelNorms.has(normalizeForScorecardMatch(nm));
  });
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

async function main(): Promise<void> {
  loadDotenvFromCwd();
  const apiKey = process.env.SCORECARD_API_KEY;
  if (!apiKey?.trim()) {
    console.error("Missing SCORECARD_API_KEY");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const schools = await prisma.school.findMany({
    select: { name: true, state: true },
    orderBy: [{ state: "asc" }, { name: "asc" }],
  });
  await prisma.$disconnect();

  const collectedAt = new Date().toISOString();
  const schoolsOut: Record<string, unknown>[] = [];

  let matched = 0;
  let skipped = 0;

  for (const sch of schools) {
    let candidates: ScorecardFlatRow[] = [];
    let sawAmbiguous = false;
    const queries = scorecardSearchQuerySequence(sch.name);

    for (const query of queries) {
      let rows: ScorecardFlatRow[];
      try {
        rows = await scorecardFetch(query, sch.state, apiKey);
      } catch (e) {
        console.error(`[error] fetch ${sch.name} (${sch.state}) query=${JSON.stringify(query)}:`, e);
        process.exit(1);
      }

      const cand = filterMatches(rows, sch.name, sch.state);
      if (cand.length > 1) {
        const ids = cand
          .map((r) => n(r, "id"))
          .filter((x): x is number => x !== null)
          .join(", ");
        console.warn(
          `[skip] ambiguous_match: ${sch.name} (${sch.state}) — scorecard ids: ${ids}`,
        );
        sawAmbiguous = true;
        skipped += 1;
        break;
      }
      if (cand.length === 1) {
        candidates = cand;
        break;
      }
      await sleep(400);
    }

    if (sawAmbiguous) {
      await sleep(400);
      continue;
    }

    if (candidates.length === 0) {
      console.warn(`[skip] no_results: ${sch.name} (${sch.state})`);
      skipped += 1;
    } else {
      const row = candidates[0]!;
      const scId = n(row, "id");
      const { json, nullPrismaFields } = mapRowToPayload(row, sch.state, collectedAt);
      json.name = sch.name;
      schoolsOut.push(json);
      matched += 1;
      console.log(`[match] ${sch.name} (${sch.state}) scorecardId=${scId}`);
      if (nullPrismaFields.length > 0) {
        console.log(`  null fields: ${nullPrismaFields.join(", ")}`);
      }
    }

    await sleep(400);
  }

  const outDir = join(process.cwd(), "data", "imports");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, `scorecard_${todayStamp()}.json`);
  const envelope = {
    source: "scorecard",
    collectedAt,
    schools: schoolsOut,
  };
  writeFileSync(outPath, `${JSON.stringify(envelope, null, 2)}\n`, "utf8");
  console.log(`\nWrote ${outPath} (${matched} matched, ${skipped} skipped, ${schools.length} total)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
