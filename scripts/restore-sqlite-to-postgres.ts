/**
 * One-time restore: copies all application data from a local SQLite dev.db
 * into the configured PostgreSQL database (e.g. Supabase).
 *
 * Usage:
 *   SQLITE_PATH=prisma/dev.db npx tsx scripts/restore-sqlite-to-postgres.ts
 *
 * Requires DATABASE_URL / DIRECT_URL in .env (same as Prisma).
 * Destroys existing rows in all Prisma tables before importing.
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

const root = process.cwd();
const sqlitePath = process.env.SQLITE_PATH ?? join(root, "prisma", "dev.db");

function qJson(db: string, sql: string): unknown[] {
  const out = execFileSync("sqlite3", [db, "-json", sql], { encoding: "utf8" });
  if (!out.trim()) return [];
  return JSON.parse(out) as unknown[];
}

function asBool(v: unknown): boolean | undefined {
  if (v === null || v === undefined) return undefined;
  if (typeof v === "boolean") return v;
  if (v === 0 || v === 1) return Boolean(v);
  return undefined;
}

function asDate(v: unknown): Date | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function asNum(v: unknown): number | undefined | null {
  if (v === null) return null;
  if (v === undefined || v === "") return undefined;
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

async function main() {
  if (!existsSync(sqlitePath)) {
    console.error(`[restore] SQLite file not found: ${sqlitePath}`);
    process.exit(1);
  }

  const prisma = new PrismaClient();

  const schools = qJson(sqlitePath, "SELECT * FROM School") as Record<string, unknown>[];
  const swimRows = qJson(sqlitePath, "SELECT * FROM SwimData") as Record<string, unknown>[];
  const academicRows = qJson(sqlitePath, "SELECT * FROM AcademicProfile") as Record<string, unknown>[];
  const financialRows = qJson(sqlitePath, "SELECT * FROM FinancialModel") as Record<string, unknown>[];
  const coachRows = qJson(sqlitePath, "SELECT * FROM CoachContact") as Record<string, unknown>[];
  const domainRows = qJson(sqlitePath, "SELECT * FROM SchoolEmailDomain") as Record<string, unknown>[];
  const gmailRows = qJson(sqlitePath, "SELECT * FROM GmailSchoolLink") as Record<string, unknown>[];
  const profiles = qJson(sqlitePath, "SELECT * FROM StudentProfile") as Record<string, unknown>[];

  console.log(
    `[restore] From ${sqlitePath}: schools=${schools.length} swim=${swimRows.length} academic=${academicRows.length} financial=${financialRows.length} coach=${coachRows.length} domains=${domainRows.length} gmail=${gmailRows.length} studentProfile=${profiles.length}`,
  );

  await prisma.$transaction(
    async (tx) => {
      await tx.coachContact.deleteMany();
      await tx.gmailSchoolLink.deleteMany();
      await tx.schoolEmailDomain.deleteMany();
      await tx.swimData.deleteMany();
      await tx.academicProfile.deleteMany();
      await tx.financialModel.deleteMany();
      await tx.studentProfile.deleteMany();
      await tx.school.deleteMany();

      for (const r of schools) {
        await tx.school.create({
          data: {
            id: String(r.id),
            name: String(r.name),
            state: String(r.state),
            city: r.city != null ? String(r.city) : null,
            scorecardId: asNum(r.scorecardId) ?? null,
            institutionType: String(r.institutionType),
            latitude: asNum(r.latitude) ?? null,
            longitude: asNum(r.longitude) ?? null,
            distanceFromHome: asNum(r.distanceFromHome) ?? null,
            status: String(r.lifecycleStatus ?? "None"),
            rejectionReason: r.rejectionReason != null ? String(r.rejectionReason) : null,
            abigailFavorite: asBool(r.abigailFavorite) ?? false,
            interested: asBool(r.interested) ?? false,
            phoneCall: asBool(r.phoneCall) ?? false,
            campusVisit: asBool(r.campusVisit) ?? false,
            enrichmentComplete: asBool(r.enrichmentComplete) ?? false,
            notes: r.notes != null ? String(r.notes) : null,
            aiSummary: r.aiSummary != null ? String(r.aiSummary) : null,
            summaryGeneratedAt: asDate(r.summaryGeneratedAt),
            appDeadlineEA: asDate(r.appDeadlineEA),
            appDeadlineED: asDate(r.appDeadlineED),
            appDeadlineRD: asDate(r.appDeadlineRD),
            createdAt: asDate(r.createdAt) ?? new Date(),
            updatedAt: asDate(r.updatedAt) ?? new Date(),
          },
        });
      }

      for (const r of swimRows) {
        await tx.swimData.create({
          data: {
            id: String(r.id),
            schoolId: String(r.schoolId),
            ncaaDivision: r.ncaaDivision != null ? String(r.ncaaDivision) : null,
            hasSwimTeam: asBool(r.hasSwimTeam) ?? true,
            notInSwimCloud: asBool(r.notInSwimCloud) ?? false,
            athleticTier: r.athleticTier != null ? String(r.athleticTier) : null,
            teamPowerIndexAvg: asNum(r.teamPowerIndexAvg) ?? null,
            abigailRank: asNum(r.abigailRank) != null ? Math.trunc(asNum(r.abigailRank)!) : null,
            rosterSize: asNum(r.rosterSize) != null ? Math.trunc(asNum(r.rosterSize)!) : null,
            seniorsGraduating: asNum(r.seniorsGraduating) != null ? Math.trunc(asNum(r.seniorsGraduating)!) : null,
            swimcloudUrl: r.swimcloudUrl != null ? String(r.swimcloudUrl) : null,
            swimcloudTeamId: asNum(r.swimcloudTeamId) != null ? Math.trunc(asNum(r.swimcloudTeamId)!) : null,
            dataCollectedAt: asDate(r.dataCollectedAt),
            matchScore: asNum(r.matchScore) != null ? Math.trunc(asNum(r.matchScore)!) : null,
            teamRankDisplay: r.teamRankDisplay != null ? String(r.teamRankDisplay) : null,
            conference: r.conference != null ? String(r.conference) : null,
            athleteEvent: r.athleteEvent != null ? String(r.athleteEvent) : null,
            distanceMiles: asNum(r.distanceMiles) != null ? Math.trunc(asNum(r.distanceMiles)!) : null,
            schoolSize: r.schoolSize != null ? String(r.schoolSize) : null,
            pageCity: r.pageCity != null ? String(r.pageCity) : null,
            pageState: r.pageState != null ? String(r.pageState) : null,
            pageSetting: r.pageSetting != null ? String(r.pageSetting) : null,
            swimcloudAvgNetCost: asNum(r.swimcloudAvgNetCost) != null ? Math.trunc(asNum(r.swimcloudAvgNetCost)!) : null,
            importSnapshotJson: r.importSnapshotJson != null ? String(r.importSnapshotJson) : null,
            coachingStaffJson: r.coachingStaffJson != null ? String(r.coachingStaffJson) : null,
            createdAt: asDate(r.createdAt) ?? new Date(),
            updatedAt: asDate(r.updatedAt) ?? new Date(),
          },
        });
      }

      for (const r of academicRows) {
        await tx.academicProfile.create({
          data: {
            id: String(r.id),
            schoolId: String(r.schoolId),
            programLabel: r.programLabel != null ? String(r.programLabel) : null,
            programType: r.programType != null ? String(r.programType) : null,
            flagshipSchool: r.flagshipSchool != null ? String(r.flagshipSchool) : null,
            programNotes: r.programNotes != null ? String(r.programNotes) : null,
            studyAbroadLevel: r.studyAbroadLevel != null ? String(r.studyAbroadLevel) : null,
            studyAbroadNotes: r.studyAbroadNotes != null ? String(r.studyAbroadNotes) : null,
            acceptanceRate: asNum(r.acceptanceRate) ?? null,
            satMid50Low: asNum(r.satMid50Low) != null ? Math.trunc(asNum(r.satMid50Low)!) : null,
            satMid50High: asNum(r.satMid50High) != null ? Math.trunc(asNum(r.satMid50High)!) : null,
            satMathMid50Low: asNum(r.satMathMid50Low) != null ? Math.trunc(asNum(r.satMathMid50Low)!) : null,
            satMathMid50High: asNum(r.satMathMid50High) != null ? Math.trunc(asNum(r.satMathMid50High)!) : null,
            satEBRWMid50Low: asNum(r.satEBRWMid50Low) != null ? Math.trunc(asNum(r.satEBRWMid50Low)!) : null,
            satEBRWMid50High: asNum(r.satEBRWMid50High) != null ? Math.trunc(asNum(r.satEBRWMid50High)!) : null,
            enrollmentSize: asNum(r.enrollmentSize) != null ? Math.trunc(asNum(r.enrollmentSize)!) : null,
            setting: r.setting != null ? String(r.setting) : null,
            retentionRate: asNum(r.retentionRate) ?? null,
            gradRate4Year: asNum(r.gradRate4Year) ?? null,
            studentFacultyRatio: asNum(r.studentFacultyRatio) ?? null,
            t14Placements: r.t14Placements != null ? String(r.t14Placements) : null,
            preLawQuality: r.preLawQuality != null ? String(r.preLawQuality) : null,
            feederReputation: r.feederReputation != null ? String(r.feederReputation) : null,
            dataCollectedAt: asDate(r.dataCollectedAt),
            createdAt: asDate(r.createdAt) ?? new Date(),
            updatedAt: asDate(r.updatedAt) ?? new Date(),
          },
        });
      }

      for (const r of financialRows) {
        await tx.financialModel.create({
          data: {
            id: String(r.id),
            schoolId: String(r.schoolId),
            publishedCOA: asNum(r.publishedCOA) != null ? Math.trunc(asNum(r.publishedCOA)!) : null,
            averageAnnualCost: asNum(r.averageAnnualCost) != null ? Math.trunc(asNum(r.averageAnnualCost)!) : null,
            tuition: asNum(r.tuition) != null ? Math.trunc(asNum(r.tuition)!) : null,
            roomAndBoard: asNum(r.roomAndBoard) != null ? Math.trunc(asNum(r.roomAndBoard)!) : null,
            feesAndOther: asNum(r.feesAndOther) != null ? Math.trunc(asNum(r.feesAndOther)!) : null,
            estimatedMeritAid: asNum(r.estimatedMeritAid) != null ? Math.trunc(asNum(r.estimatedMeritAid)!) : null,
            athleticAidAvailable: asBool(r.athleticAidAvailable),
            estimatedAthleticAid: asNum(r.estimatedAthleticAid) != null ? Math.trunc(asNum(r.estimatedAthleticAid)!) : null,
            needAidLikely: asBool(r.needAidLikely),
            avgNetCostHighIncome: asNum(r.avgNetCostHighIncome) != null ? Math.trunc(asNum(r.avgNetCostHighIncome)!) : null,
            estimatedNetCost: asNum(r.estimatedNetCost) != null ? Math.trunc(asNum(r.estimatedNetCost)!) : null,
            fourYearEstimate: asNum(r.fourYearEstimate) != null ? Math.trunc(asNum(r.fourYearEstimate)!) : null,
            financialNotes: r.financialNotes != null ? String(r.financialNotes) : null,
            createdAt: asDate(r.createdAt) ?? new Date(),
            updatedAt: asDate(r.updatedAt) ?? new Date(),
          },
        });
      }

      for (const r of coachRows) {
        await tx.coachContact.create({
          data: {
            id: String(r.id),
            schoolId: String(r.schoolId),
            date: asDate(r.date) ?? new Date(),
            direction: String(r.direction),
            type: String(r.type),
            summary: String(r.summary),
            rawContent: r.rawContent != null ? String(r.rawContent) : null,
            draftedReply: asBool(r.draftedReply) ?? false,
            createdAt: asDate(r.createdAt) ?? new Date(),
            updatedAt: asDate(r.updatedAt) ?? new Date(),
          },
        });
      }

      for (const r of domainRows) {
        await tx.schoolEmailDomain.create({
          data: {
            id: String(r.id),
            schoolId: String(r.schoolId),
            domain: String(r.domain),
            createdAt: asDate(r.createdAt) ?? new Date(),
          },
        });
      }

      for (const r of gmailRows) {
        await tx.gmailSchoolLink.create({
          data: {
            id: String(r.id),
            schoolId: String(r.schoolId),
            gmailMessageId: String(r.gmailMessageId),
            senderEmail: String(r.senderEmail),
            subject: r.subject != null ? String(r.subject) : null,
            linkedAt: asDate(r.linkedAt) ?? new Date(),
          },
        });
      }

      for (const r of profiles) {
        await tx.studentProfile.create({
          data: {
            id: String(r.id),
            powerIndex: asNum(r.powerIndex) ?? null,
            satMath: asNum(r.satMath) != null ? Math.trunc(asNum(r.satMath)!) : null,
            satEBRW: asNum(r.satEBRW) != null ? Math.trunc(asNum(r.satEBRW)!) : null,
            satComposite: asNum(r.satComposite) != null ? Math.trunc(asNum(r.satComposite)!) : null,
            gpa: asNum(r.gpa) ?? null,
            graduationYear: asNum(r.graduationYear) != null ? Math.trunc(asNum(r.graduationYear)!) : null,
            studyAbroadInterest: asBool(r.studyAbroadInterest) ?? true,
            divisionPreference: r.divisionPreference != null ? String(r.divisionPreference) : null,
            sizePreference: r.sizePreference != null ? String(r.sizePreference) : null,
            geographyNotes: r.geographyNotes != null ? String(r.geographyNotes) : null,
            writingProfile: r.writingProfile != null ? String(r.writingProfile) : null,
            studyAbroadProfile: r.studyAbroadProfile != null ? String(r.studyAbroadProfile) : null,
            createdAt: asDate(r.createdAt) ?? new Date(),
            updatedAt: asDate(r.updatedAt) ?? new Date(),
          },
        });
      }
    },
    { timeout: 300_000 },
  );

  const [sc, sw, ap, sp] = await Promise.all([
    prisma.school.count(),
    prisma.swimData.count(),
    prisma.academicProfile.count(),
    prisma.studentProfile.count(),
  ]);
  console.log(`[restore] Done. Postgres now: schools=${sc} swim=${sw} academic=${ap} studentProfile=${sp}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
