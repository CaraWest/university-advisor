/**
 * Applies data/swimcloud-scorecard-map.json to SwimData.swimcloudTeamId for schools
 * with matching School.scorecardId. Run after scorecard import populates scorecardId.
 *
 * Usage: npx tsx scripts/sync-swimcloud-scorecard-map.ts [path]
 * Default path: data/swimcloud-scorecard-map.json (or SWIMCLOUD_SCORECARD_MAP)
 */
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { prisma } from "../lib/db";
import { swimcloudScorecardMapSchema } from "../lib/validation/swimcloud-scorecard-map";

function mapPath(): string {
  const env = process.env.SWIMCLOUD_SCORECARD_MAP?.trim();
  if (env) {
    return env.startsWith("/") ? env : join(process.cwd(), env);
  }
  return join(process.cwd(), "data", "swimcloud-scorecard-map.json");
}

async function main() {
  const path = process.argv[2]?.trim() || mapPath();
  if (!existsSync(path)) {
    console.error(
      `No map file at ${path}\nCopy data/swimcloud-scorecard-map.example.json to data/swimcloud-scorecard-map.json and edit.\n`,
    );
    process.exit(1);
  }

  const raw: unknown = JSON.parse(await readFile(path, "utf8"));
  const parsed = swimcloudScorecardMapSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("Invalid map JSON:", parsed.error.flatten());
    process.exit(1);
  }

  let applied = 0;
  let orphans: { scorecardId: number; swimcloudTeamId: number }[] = [];

  for (const entry of parsed.data) {
    const school = await prisma.school.findFirst({
      where: { scorecardId: entry.scorecardId },
      select: { id: true, name: true },
    });
    if (!school) {
      orphans.push({ scorecardId: entry.scorecardId, swimcloudTeamId: entry.swimcloudTeamId });
      continue;
    }

    await prisma.swimData.upsert({
      where: { schoolId: school.id },
      create: {
        schoolId: school.id,
        swimcloudTeamId: entry.swimcloudTeamId,
        hasSwimTeam: true,
        notInSwimCloud: false,
      },
      update: {
        swimcloudTeamId: entry.swimcloudTeamId,
        notInSwimCloud: false,
      },
    });
    applied += 1;
    console.log(`OK ${school.name} (scorecard ${entry.scorecardId}) → SwimCloud team ${entry.swimcloudTeamId}`);
  }

  console.log(`\nApplied ${applied} map row(s).`);
  if (orphans.length > 0) {
    console.warn(
      `\nOrphans (no School with this scorecardId — run scorecard import or add school):\n${orphans
        .map((o) => `  scorecardId ${o.scorecardId} → team ${o.swimcloudTeamId}`)
        .join("\n")}\n`,
    );
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
