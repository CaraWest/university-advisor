/**
 * Validate a SwimCloud import JSON against lib/validation/import-envelope.ts.
 *
 * Usage: npx tsx scripts/swimcloud/validate-sample.ts path/to/swimcloud_*.json
 *
 * Optional: SWIMCLOUD_VALIDATE_GOLDEN=1 requires rows for scrapeTeamId 261 and 419 with at least one of
 * matchScore, teamPowerIndexAvg (spot-check that the scrape saw fit data).
 */
import { readFile } from "node:fs/promises";

import {
  schoolImportEnvelopeSchema,
  swimcloudSchoolSchema,
} from "../../lib/validation/import-envelope";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

async function main() {
  const path = process.argv[2]?.trim();
  if (!path) {
    console.error("Usage: npx tsx scripts/swimcloud/validate-sample.ts <swimcloud.json>\n");
    process.exit(1);
  }

  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(path, "utf8"));
  } catch (e) {
    console.error("Invalid JSON:", e);
    process.exit(1);
  }

  const env = schoolImportEnvelopeSchema.safeParse(raw);
  if (!env.success) {
    console.error("Envelope validation failed:\n", env.error.flatten());
    process.exit(1);
  }
  if (env.data.source !== "swimcloud") {
    console.error("Expected source: swimcloud, got:", env.data.source);
    process.exit(1);
  }

  for (let i = 0; i < env.data.schools.length; i++) {
    const s = swimcloudSchoolSchema.safeParse(env.data.schools[i]);
    if (!s.success) {
      console.error(`schools[${i}] failed:`, s.error.flatten());
      process.exit(1);
    }
  }

  if (process.env.SWIMCLOUD_VALIDATE_GOLDEN === "1" || process.env.SWIMCLOUD_VALIDATE_GOLDEN === "true") {
    const byTeamId = new Map<number, Record<string, unknown>>();
    for (const sch of env.data.schools) {
      if (!isRecord(sch)) continue;
      const id = sch.scrapeTeamId;
      if (typeof id === "number" && Number.isInteger(id)) {
        byTeamId.set(id, sch);
      }
    }
    const goldenIds = [261, 419] as const;
    for (const teamId of goldenIds) {
      const row = byTeamId.get(teamId);
      if (!row) {
        console.error(`Golden check: missing school with scrapeTeamId ${teamId} (CMS / Occidental samples).`);
        process.exit(1);
      }
      const hasFit =
        typeof row.matchScore === "number" ||
        typeof row.teamPowerIndexAvg === "number";
      if (!hasFit) {
        console.error(
          `Golden check: team ${teamId} (${row.name}) missing both matchScore and teamPowerIndexAvg — selectors or paywall?`,
        );
        process.exit(1);
      }
    }
  }

  console.log(`OK ${path} — ${env.data.schools.length} swimcloud school row(s)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
