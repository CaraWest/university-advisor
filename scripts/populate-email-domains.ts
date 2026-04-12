/**
 * Fetches school.school_url from College Scorecard for each School with a
 * scorecardId, extracts the root domain, and populates SchoolEmailDomain.
 *
 * Produces a summary table at the end showing which schools were populated and
 * which need manual attention.
 *
 * Requires SCORECARD_API_KEY and DATABASE_URL (from .env).
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

const SCORECARD_BASE =
  "https://api.data.gov/ed/collegescorecard/v1/schools.json";

const BATCH_SIZE = 50;

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

const MULTI_PART_TLDS = new Set([
  "ac.uk", "co.uk", "org.uk", "ac.nz", "co.nz", "ac.jp", "co.jp",
  "com.au", "edu.au", "ac.za", "co.za", "ac.kr",
]);

function extractRootDomain(raw: string): string | null {
  let url = raw.trim().toLowerCase();
  if (!url) return null;
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = "https://" + url;
  }
  try {
    const hostname = new URL(url).hostname.replace(/\.$/, "");
    const parts = hostname.split(".");
    if (parts.length < 2) return null;

    const last2 = parts.slice(-2).join(".");
    if (parts.length >= 3 && MULTI_PART_TLDS.has(last2)) {
      return parts.slice(-3).join(".");
    }
    return last2;
  } catch {
    return null;
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

type ScorecardRow = {
  id: number;
  "school.school_url"?: string | null;
  "school.name"?: string | null;
};

async function fetchBatch(
  ids: number[],
  apiKey: string,
): Promise<ScorecardRow[]> {
  const url = new URL(SCORECARD_BASE);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("id", ids.join(","));
  url.searchParams.set("fields", "id,school.name,school.school_url");
  url.searchParams.set("per_page", String(BATCH_SIZE));

  const maxAttempts = 5;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch(url);
    if (res.status === 429 && attempt < maxAttempts) {
      const retryAfter = Number(res.headers.get("retry-after")) || 5 * attempt;
      console.warn(
        `[rate_limit] backing off ${retryAfter}s (attempt ${attempt}/${maxAttempts})`,
      );
      await sleep(retryAfter * 1000);
      continue;
    }
    if (!res.ok) {
      throw new Error(`Scorecard HTTP ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as { results?: ScorecardRow[] };
    return data.results ?? [];
  }
  throw new Error("Scorecard: exhausted retries");
}

async function main(): Promise<void> {
  loadDotenvFromCwd();
  const apiKey = process.env.SCORECARD_API_KEY;
  if (!apiKey?.trim()) {
    console.error("Missing SCORECARD_API_KEY in .env");
    process.exit(1);
  }

  const prisma = new PrismaClient();

  const schools = await prisma.school.findMany({
    select: { id: true, name: true, state: true, scorecardId: true },
    orderBy: [{ state: "asc" }, { name: "asc" }],
  });

  const withId = schools.filter(
    (s): s is typeof s & { scorecardId: number } => s.scorecardId !== null,
  );
  const noId = schools.filter((s) => s.scorecardId === null);

  console.log(
    `${schools.length} schools total, ${withId.length} with scorecardId, ${noId.length} without\n`,
  );

  // Build a lookup from scorecardId -> our school rows (handle dupes)
  const byScorecard = new Map<
    number,
    { id: string; name: string; state: string }[]
  >();
  for (const s of withId) {
    const arr = byScorecard.get(s.scorecardId) ?? [];
    arr.push(s);
    byScorecard.set(s.scorecardId, arr);
  }

  // Fetch URLs in batches
  const allIds = withId.map((s) => s.scorecardId);
  const urlMap = new Map<number, string | null>();

  for (let i = 0; i < allIds.length; i += BATCH_SIZE) {
    const batch = allIds.slice(i, i + BATCH_SIZE);
    const rows = await fetchBatch(batch, apiKey);
    for (const row of rows) {
      urlMap.set(
        row.id,
        (row["school.school_url"] as string | null) ?? null,
      );
    }
    if (i + BATCH_SIZE < allIds.length) await sleep(500);
  }

  // Derive domains and prepare inserts
  type Result = {
    schoolName: string;
    state: string;
    domain: string | null;
    url: string | null;
    status: "added" | "duplicate" | "no_url" | "bad_url" | "no_scorecard";
  };
  const results: Result[] = [];

  // Track domains we'll insert so we can detect duplicates within this run
  const domainToSchool = new Map<string, string>();
  const toInsert: { schoolId: string; domain: string }[] = [];

  for (const school of schools) {
    if (school.scorecardId === null) {
      results.push({
        schoolName: school.name,
        state: school.state,
        domain: null,
        url: null,
        status: "no_scorecard",
      });
      continue;
    }

    const rawUrl = urlMap.get(school.scorecardId) ?? null;
    if (!rawUrl) {
      results.push({
        schoolName: school.name,
        state: school.state,
        domain: null,
        url: null,
        status: "no_url",
      });
      continue;
    }

    const domain = extractRootDomain(rawUrl);
    if (!domain) {
      results.push({
        schoolName: school.name,
        state: school.state,
        domain: null,
        url: rawUrl,
        status: "bad_url",
      });
      continue;
    }

    const existingOwner = domainToSchool.get(domain);
    if (existingOwner && existingOwner !== school.id) {
      results.push({
        schoolName: school.name,
        state: school.state,
        domain,
        url: rawUrl,
        status: "duplicate",
      });
      continue;
    }

    domainToSchool.set(domain, school.id);
    toInsert.push({ schoolId: school.id, domain });
    results.push({
      schoolName: school.name,
      state: school.state,
      domain,
      url: rawUrl,
      status: "added",
    });
  }

  // Upsert domains (skip existing)
  let inserted = 0;
  let skippedExisting = 0;
  for (const { schoolId, domain } of toInsert) {
    try {
      await prisma.schoolEmailDomain.create({
        data: { schoolId, domain },
      });
      inserted++;
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === "P2002") {
        skippedExisting++;
      } else {
        throw err;
      }
    }
  }

  // Print summary
  const added = results.filter((r) => r.status === "added");
  const noUrl = results.filter((r) => r.status === "no_url");
  const badUrl = results.filter((r) => r.status === "bad_url");
  const dupes = results.filter((r) => r.status === "duplicate");
  const noSc = results.filter((r) => r.status === "no_scorecard");

  console.log(`\n=== RESULTS ===`);
  console.log(`Domains inserted:         ${inserted}`);
  console.log(`Already existed (skipped): ${skippedExisting}`);
  console.log(`Total schools:             ${schools.length}`);
  console.log(`  ✓ Domain populated:      ${added.length}`);
  console.log(`  ✗ No URL from Scorecard: ${noUrl.length}`);
  console.log(`  ✗ Bad/unparseable URL:   ${badUrl.length}`);
  console.log(`  ✗ Duplicate domain:      ${dupes.length}`);
  console.log(`  ✗ No scorecardId:        ${noSc.length}`);

  const needsManual = [...noUrl, ...badUrl, ...dupes, ...noSc];
  if (needsManual.length > 0) {
    console.log(`\n=== NEEDS MANUAL ATTENTION (${needsManual.length}) ===`);
    for (const r of needsManual) {
      const reason =
        r.status === "no_url"
          ? "no URL in Scorecard"
          : r.status === "bad_url"
            ? `unparseable URL: ${r.url}`
            : r.status === "duplicate"
              ? `domain ${r.domain} already assigned to another school`
              : "no scorecardId";
      console.log(`  ${r.schoolName} (${r.state}) — ${reason}`);
    }
  }

  if (dupes.length > 0) {
    console.log(`\n=== DUPLICATE DOMAINS (shared by multiple schools) ===`);
    const dupeDomains = Array.from(new Set(dupes.map((r) => r.domain).filter(Boolean)));
    for (const d of dupeDomains) {
      const sharing = results.filter((r) => r.domain === d);
      console.log(
        `  ${d}: ${sharing.map((r) => `${r.schoolName} (${r.state})`).join(", ")}`,
      );
    }
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
