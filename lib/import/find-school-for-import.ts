import type { PrismaClient } from "@prisma/client";
import { normalizeImportSchoolName, COWORK_NAME_ALIASES } from "@/lib/import/cowork-name-aliases";
import type { SwimcloudSchoolRow } from "@/lib/import/swimcloud-row-metrics";
import { parseSwimcloudTeamIdFromUrl } from "@/lib/swimcloud-team-id";

export type SchoolMatch = { id: string; name: string; state: string; institutionType: string };

export async function findSchoolByScorecardId(
  prisma: PrismaClient,
  scorecardId: number,
): Promise<SchoolMatch | null> {
  return prisma.school.findFirst({
    where: { scorecardId },
    select: { id: true, name: true, state: true, institutionType: true },
  });
}

export async function findSchoolBySwimcloudTeamId(
  prisma: PrismaClient,
  swimcloudTeamId: number,
): Promise<SchoolMatch | null> {
  return prisma.school.findFirst({
    where: { swimData: { swimcloudTeamId } },
    select: { id: true, name: true, state: true, institutionType: true },
  });
}

export async function findSchoolByImportName(
  prisma: PrismaClient,
  rawName: string,
): Promise<SchoolMatch | null> {
  const normalized = normalizeImportSchoolName(rawName);
  const aliased = COWORK_NAME_ALIASES[normalized];
  const searchName = aliased ?? rawName;

  return prisma.school.findFirst({
    where: { name: { equals: searchName, mode: "insensitive" } },
    select: { id: true, name: true, state: true, institutionType: true },
  });
}

/** @deprecated Use findSchoolByImportName — kept for call sites that only pass a name. */
export async function findSchoolForImport(
  prisma: PrismaClient,
  rawName: string,
): Promise<SchoolMatch | null> {
  return findSchoolByImportName(prisma, rawName);
}

/** SwimCloud import: scorecardId > swimcloudTeamId (row or scrapeTeamId or swimcloudUrl) > name + aliases. */
export function swimcloudTeamIdFromRow(row: SwimcloudSchoolRow): number | undefined {
  if (row.swimcloudTeamId != null) {
    const n = Number(row.swimcloudTeamId);
    if (Number.isInteger(n) && n > 0) return n;
  }
  const p = row as Record<string, unknown>;
  const s = p.scrapeTeamId;
  const sN = typeof s === "number" ? s : typeof s === "string" ? Number(s) : NaN;
  if (Number.isInteger(sN) && sN > 0) return sN;
  return parseSwimcloudTeamIdFromUrl(row.swimcloudUrl);
}

export async function resolveSchoolForSwimcloudImport(
  prisma: PrismaClient,
  row: SwimcloudSchoolRow,
): Promise<SchoolMatch | null> {
  if (row.scorecardId != null) {
    const sid = Number(row.scorecardId);
    if (Number.isInteger(sid) && sid > 0) {
      const bySc = await findSchoolByScorecardId(prisma, sid);
      if (bySc) return bySc;
    }
  }
  const teamId = swimcloudTeamIdFromRow(row);
  if (teamId != null) {
    const byTeam = await findSchoolBySwimcloudTeamId(prisma, teamId);
    if (byTeam) return byTeam;
  }
  return findSchoolByImportName(prisma, row.name);
}
