import type { PrismaClient } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { athleticTierFromTeamPowerIndex, distanceMilesFromRoundRock } from "@/lib/derived";
import {
  findSchoolForImport,
  resolveSchoolForSwimcloudImport,
  swimcloudTeamIdFromRow,
} from "@/lib/import/find-school-for-import";
import { swimcloudRowHasFitMetrics } from "@/lib/import/swimcloud-row-metrics";
import type { ScorecardSchoolRow } from "@/lib/validation/import-envelope";
import type { z } from "zod";
import {
  financialSchoolSchema,
  researchSchoolSchema,
  swimcloudSchoolSchema,
} from "@/lib/validation/import-envelope";

type SwimcloudSchool = z.infer<typeof swimcloudSchoolSchema>;
type ResearchSchool = z.infer<typeof researchSchoolSchema>;
type FinancialSchool = z.infer<typeof financialSchoolSchema>;

export type ApplyChunkResult = {
  processed: number;
  skipped: number;
  messages: string[];
};

function stripUndef<T extends Record<string, unknown>>(o: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    if (v !== undefined && v !== null) out[k] = v;
  }
  return out as Partial<T>;
}

function parseOptionalDate(iso: string | undefined): Date | undefined {
  if (!iso?.trim()) return undefined;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function roundPct(n: number): number {
  return Math.round(n * 100) / 100;
}

/** AcademicProfile fields shared with scorecard — filled from SwimCloud only when still null (scorecard supersedes). */
function academicPatchFromSwimIfEmpty(
  row: SwimcloudSchool,
  existing: {
    acceptanceRate: number | null;
    satMid50Low: number | null;
    satMid50High: number | null;
    satMathMid50Low: number | null;
    satMathMid50High: number | null;
    satEBRWMid50Low: number | null;
    satEBRWMid50High: number | null;
    enrollmentSize: number | null;
    setting: string | null;
    retentionRate: number | null;
    gradRate4Year: number | null;
  } | null,
): Prisma.AcademicProfileUncheckedUpdateInput {
  const e = existing;
  const patch: Prisma.AcademicProfileUncheckedUpdateInput = {};
  if (row.acceptanceRate != null && (e == null || e.acceptanceRate == null)) {
    patch.acceptanceRate = roundPct(Number(row.acceptanceRate));
  }
  if (row.satMid50Low != null && (e == null || e.satMid50Low == null)) {
    patch.satMid50Low = Math.round(Number(row.satMid50Low));
  }
  if (row.satMid50High != null && (e == null || e.satMid50High == null)) {
    patch.satMid50High = Math.round(Number(row.satMid50High));
  }
  if (row.enrollmentSize != null && (e == null || e.enrollmentSize == null)) {
    patch.enrollmentSize = Math.round(Number(row.enrollmentSize));
  }
  if (row.setting != null && String(row.setting).trim() && (e == null || e.setting == null)) {
    patch.setting = String(row.setting);
  }
  if (row.retentionRate != null && (e == null || e.retentionRate == null)) {
    patch.retentionRate = roundPct(Number(row.retentionRate));
  }
  if (row.gradRate4Year != null && (e == null || e.gradRate4Year == null)) {
    patch.gradRate4Year = roundPct(Number(row.gradRate4Year));
  }
  return patch;
}

export async function applySwimcloudImport(
  prisma: PrismaClient,
  schools: SwimcloudSchool[],
  collectedAtIso: string,
): Promise<ApplyChunkResult> {
  const messages: string[] = [];
  let processed = 0;
  let skipped = 0;
  const dataCollectedAt = parseOptionalDate(collectedAtIso);

  for (const row of schools) {
    const school = await resolveSchoolForSwimcloudImport(prisma, row);
    if (!school) {
      messages.push(
        `swimcloud: could not resolve school (try scorecardId, map swimcloudTeamId sync, or name) "${row.name}"`,
      );
      skipped += 1;
      continue;
    }

    let importSnapshotJson: string | undefined;
    try {
      importSnapshotJson = JSON.stringify(row);
    } catch {
      importSnapshotJson = undefined;
    }

    const passthrough = row as Record<string, unknown>;
    const hasFitMetrics = swimcloudRowHasFitMetrics(row);
    const existingSwim = await prisma.swimData.findUnique({
      where: { schoolId: school.id },
      select: { id: true },
    });

    if (passthrough.notInSwimCloud === true || passthrough.capturedAsConsortium === true) {
      await prisma.swimData.upsert({
        where: { schoolId: school.id },
        create: {
          schoolId: school.id,
          hasSwimTeam: false,
          notInSwimCloud: true,
          swimcloudTeamId: null,
          importSnapshotJson,
          ...(dataCollectedAt ? { dataCollectedAt } : {}),
        },
        update: {
          hasSwimTeam: false,
          notInSwimCloud: true,
          swimcloudTeamId: null,
          importSnapshotJson,
          ...(dataCollectedAt ? { dataCollectedAt } : {}),
        },
      });
      processed += 1;
      continue;
    }

    const thinRepeatScrape = existingSwim != null && !hasFitMetrics;
    const resolvedTeamId = swimcloudTeamIdFromRow(row);
    const swimPatch = stripUndef({
      ncaaDivision: row.ncaaDivision,
      hasSwimTeam: row.hasSwimTeam,
      notInSwimCloud: false,
      ...(resolvedTeamId != null ? { swimcloudTeamId: resolvedTeamId } : {}),
      teamPowerIndexAvg: row.teamPowerIndexAvg,
      abigailRank: row.abigailRank,
      rosterSize: row.rosterSize,
      seniorsGraduating: row.seniorsGraduating,
      swimcloudUrl: row.swimcloudUrl,
      matchScore: row.matchScore != null ? Math.round(Number(row.matchScore)) : undefined,
      teamRankDisplay: row.teamRankDisplay ?? undefined,
      conference: row.conference ?? undefined,
      athleteEvent: row.athleteEvent ?? undefined,
      distanceMiles: row.distanceMiles != null ? Math.round(Number(row.distanceMiles)) : undefined,
      schoolSize: row.schoolSize ?? undefined,
      pageCity: row.city ?? undefined,
      pageState: row.state ?? undefined,
      pageSetting: row.setting ?? undefined,
      swimcloudAvgNetCost: row.avgNetCost != null ? Math.round(Number(row.avgNetCost)) : undefined,
      ...(thinRepeatScrape ? {} : { importSnapshotJson }),
      ...(typeof row.teamPowerIndexAvg === "number" && Number.isFinite(row.teamPowerIndexAvg)
        ? { athleticTier: athleticTierFromTeamPowerIndex(row.teamPowerIndexAvg) }
        : {}),
      ...(!thinRepeatScrape && dataCollectedAt ? { dataCollectedAt } : {}),
    }) as Prisma.SwimDataUncheckedUpdateInput;

    await prisma.swimData.upsert({
      where: { schoolId: school.id },
      create: {
        schoolId: school.id,
        hasSwimTeam: row.hasSwimTeam ?? true,
        ...swimPatch,
      } as Prisma.SwimDataUncheckedCreateInput,
      update: swimPatch,
    });

    const existingAcademic = await prisma.academicProfile.findUnique({
      where: { schoolId: school.id },
      select: {
        acceptanceRate: true,
        satMid50Low: true,
        satMid50High: true,
        satMathMid50Low: true,
        satMathMid50High: true,
        satEBRWMid50Low: true,
        satEBRWMid50High: true,
        enrollmentSize: true,
        setting: true,
        retentionRate: true,
        gradRate4Year: true,
      },
    });

    const academicPatch = academicPatchFromSwimIfEmpty(row, existingAcademic);
    if (Object.keys(academicPatch).length > 0) {
      await prisma.academicProfile.upsert({
        where: { schoolId: school.id },
        create: { schoolId: school.id, ...academicPatch } as Prisma.AcademicProfileUncheckedCreateInput,
        update: academicPatch,
      });
    }

    if (row.avgNetCost != null) {
      const fm = await prisma.financialModel.findUnique({
        where: { schoolId: school.id },
        select: { estimatedNetCost: true },
      });
      if (fm?.estimatedNetCost == null) {
        const net = Math.round(Number(row.avgNetCost));
        await prisma.financialModel.upsert({
          where: { schoolId: school.id },
          create: { schoolId: school.id, estimatedNetCost: net },
          update: { estimatedNetCost: net },
        });
      }
    }

    processed += 1;
  }
  return { processed, skipped, messages };
}

export async function applyResearchImport(
  prisma: PrismaClient,
  schools: ResearchSchool[],
): Promise<ApplyChunkResult> {
  const messages: string[] = [];
  let processed = 0;
  let skipped = 0;
  for (const row of schools) {
    const school = await findSchoolForImport(prisma, row.name);
    if (!school) {
      messages.push(`school_research: unknown school name "${row.name}"`);
      skipped += 1;
      continue;
    }

    const schoolUpdate = stripUndef({
      latitude: row.latitude,
      longitude: row.longitude,
    }) as Prisma.SchoolUpdateInput;

    let distance: number | undefined;
    if (row.latitude !== undefined && row.longitude !== undefined) {
      distance = distanceMilesFromRoundRock(row.latitude, row.longitude);
    }

    if (row.institutionType !== undefined && row.institutionType.trim()) {
      const cur = school.institutionType?.trim() ?? "";
      if (!cur) {
        Object.assign(schoolUpdate, { institutionType: row.institutionType });
      } else if (cur !== row.institutionType) {
        messages.push(
          `school_research: institutionType conflict for "${row.name}" (db "${cur}" vs import "${row.institutionType}") — keeping db`,
        );
      }
    }

    await prisma.school.update({
      where: { id: school.id },
      data: {
        ...schoolUpdate,
        ...(distance !== undefined ? { distanceFromHome: distance } : {}),
      },
    });

    const { name, latitude, longitude, institutionType, researchBlob: _researchBlob, ...academicLike } = row;
    void name;
    void _researchBlob;

    const academicData = stripUndef(academicLike) as Prisma.AcademicProfileUncheckedUpdateInput;
    if (Object.keys(academicData).length > 0) {
      await prisma.academicProfile.upsert({
        where: { schoolId: school.id },
        create: { schoolId: school.id, ...academicData } as Prisma.AcademicProfileUncheckedCreateInput,
        update: academicData,
      });
    }

    processed += 1;
  }
  return { processed, skipped, messages };
}

export async function applyFinancialImport(
  prisma: PrismaClient,
  schools: FinancialSchool[],
): Promise<ApplyChunkResult> {
  const messages: string[] = [];
  let processed = 0;
  let skipped = 0;
  for (const row of schools) {
    const school = await findSchoolForImport(prisma, row.name);
    if (!school) {
      messages.push(`financial: unknown school name "${row.name}"`);
      skipped += 1;
      continue;
    }
    const data = stripUndef({
      publishedCOA: row.publishedCOA,
      tuition: row.tuition,
      roomAndBoard: row.roomAndBoard,
      feesAndOther: row.feesAndOther,
      athleticAidAvailable: row.athleticAidAvailable,
    }) as Prisma.FinancialModelUncheckedUpdateInput;
    await prisma.financialModel.upsert({
      where: { schoolId: school.id },
      create: { schoolId: school.id, ...data } as Prisma.FinancialModelUncheckedCreateInput,
      update: data,
    });
    processed += 1;
  }
  return { processed, skipped, messages };
}

export async function applyScorecardImport(
  prisma: PrismaClient,
  schools: ScorecardSchoolRow[],
): Promise<ApplyChunkResult> {
  const messages: string[] = [];
  let processed = 0;
  let skipped = 0;
  for (const row of schools) {
    const school = await findSchoolForImport(prisma, row.name);
    if (!school) {
      messages.push(`scorecard: unknown school name "${row.name}"`);
      skipped += 1;
      continue;
    }
    if (row.state !== school.state) {
      messages.push(
        `scorecard: state mismatch for "${row.name}" (db "${school.state}" vs file "${row.state}")`,
      );
      skipped += 1;
      continue;
    }

    const schoolUpdate = stripUndef({
      scorecardId: row.scorecardId,
      city: row.city,
      latitude: row.latitude,
      longitude: row.longitude,
    }) as Prisma.SchoolUpdateInput;

    let distance: number | undefined;
    if (row.latitude !== undefined && row.longitude !== undefined) {
      distance = distanceMilesFromRoundRock(row.latitude, row.longitude);
    }

    await prisma.school.update({
      where: { id: school.id },
      data: {
        ...schoolUpdate,
        ...(distance !== undefined ? { distanceFromHome: distance } : {}),
      },
    });

    const dataCollectedAt = parseOptionalDate(row.dataCollectedAt);

    const academicData = stripUndef({
      acceptanceRate: row.acceptanceRate,
      satMid50Low: row.satMid50Low,
      satMid50High: row.satMid50High,
      satMathMid50Low: row.satMathMid50Low,
      satMathMid50High: row.satMathMid50High,
      satEBRWMid50Low: row.satEBRWMid50Low,
      satEBRWMid50High: row.satEBRWMid50High,
      enrollmentSize: row.enrollmentSize,
      setting: row.setting,
      retentionRate: row.retentionRate,
      gradRate4Year: row.gradRate4Year,
      studentFacultyRatio: row.studentFacultyRatio,
      ...(dataCollectedAt ? { dataCollectedAt } : {}),
    }) as Prisma.AcademicProfileUncheckedUpdateInput;

    if (Object.keys(academicData).length > 0) {
      await prisma.academicProfile.upsert({
        where: { schoolId: school.id },
        create: { schoolId: school.id, ...academicData } as Prisma.AcademicProfileUncheckedCreateInput,
        update: academicData,
      });
    }

    const financialData = stripUndef({
      publishedCOA: row.publishedCOA,
      averageAnnualCost: row.averageAnnualCost,
      tuition: row.tuition,
      roomAndBoard: row.roomAndBoard,
      feesAndOther: row.feesAndOther,
    }) as Prisma.FinancialModelUncheckedUpdateInput;

    if (Object.keys(financialData).length > 0) {
      await prisma.financialModel.upsert({
        where: { schoolId: school.id },
        create: { schoolId: school.id, ...financialData } as Prisma.FinancialModelUncheckedCreateInput,
        update: financialData,
      });
    }

    processed += 1;
  }
  return { processed, skipped, messages };
}
