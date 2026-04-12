/**
 * Sets SwimData.swimcloudTeamId when it can be derived from swimcloudUrl or importSnapshotJson.
 * Run before DB-backed fetch: npm run swimcloud:backfill:team-ids
 */
import { prisma } from "@/lib/db";
import { effectiveSwimcloudTeamIdForSwimDataRow } from "@/lib/swimcloud-team-id";

async function main() {
  const rows = await prisma.swimData.findMany({
    where: {
      swimcloudTeamId: null,
      notInSwimCloud: false,
      hasSwimTeam: true,
    },
    select: {
      id: true,
      schoolId: true,
      swimcloudTeamId: true,
      swimcloudUrl: true,
      importSnapshotJson: true,
    },
  });

  let updated = 0;
  let stillMissing = 0;
  let parseErrors = 0;

  for (const row of rows) {
    const effective = effectiveSwimcloudTeamIdForSwimDataRow(row);
    if (effective == null) {
      stillMissing += 1;
      continue;
    }
    await prisma.swimData.update({
      where: { id: row.id },
      data: { swimcloudTeamId: effective },
    });
    updated += 1;
  }

  console.log(
    JSON.stringify(
      {
        candidates: rows.length,
        updated,
        stillMissing,
      },
      null,
      2,
    ),
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    void prisma.$disconnect();
    process.exit(1);
  });
