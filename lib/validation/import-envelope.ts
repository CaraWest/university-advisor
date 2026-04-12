import { z } from "zod";

/** Optional batch metadata at envelope level; unknown keys allowed. */
export const swimcloudImportStatsSchema = z.record(z.string(), z.unknown()).optional();

/**
 * SwimCloud export — passthrough keeps extra keys in the parsed object for importSnapshotJson.
 * Overlapping academic/financial fields are merged in applySwimcloudImport only where DB values are still null (scorecard first wins).
 */
export const swimcloudSchoolSchema = z
  .object({
    name: z.string().min(1),
    scorecardId: z.number().int().optional(),
    swimcloudTeamId: z.number().int().optional(),
    matchScore: z.number().nullish(),
    teamRankDisplay: z.string().nullish(),
    distanceMiles: z.number().nullish(),
    conference: z.string().nullish(),
    athleteEvent: z.string().nullish(),
    schoolSize: z.string().nullish(),
    city: z.string().nullish(),
    state: z.string().nullish(),
    setting: z.string().nullish(),
    acceptanceRate: z.number().nullish(),
    satMid50Low: z.number().nullish(),
    satMid50High: z.number().nullish(),
    enrollmentSize: z.number().nullish(),
    gradRate4Year: z.number().nullish(),
    retentionRate: z.number().nullish(),
    avgNetCost: z.number().nullish(),
    ncaaDivision: z.string().nullish(),
    hasSwimTeam: z.boolean().nullish(),
    teamPowerIndexAvg: z.number().nullish(),
    abigailRank: z.number().int().nullish(),
    rosterSize: z.number().int().nullish(),
    seniorsGraduating: z.number().int().nullish(),
    swimcloudUrl: z.string().nullish(),
  })
  .passthrough();

export const researchSchoolSchema = z
  .object({
    name: z.string().min(1),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    institutionType: z.string().optional(),
    programLabel: z.string().optional(),
    programType: z.string().optional(),
    flagshipSchool: z.string().nullable().optional(),
    programNotes: z.string().optional(),
    studyAbroadLevel: z.string().optional(),
    studyAbroadNotes: z.string().optional(),
    acceptanceRate: z.number().optional(),
    satMid50Low: z.number().int().optional(),
    satMid50High: z.number().int().optional(),
    enrollmentSize: z.number().int().optional(),
    setting: z.string().optional(),
    retentionRate: z.number().optional(),
    gradRate4Year: z.number().optional(),
    studentFacultyRatio: z.number().optional(),
    t14Placements: z.string().optional(),
    preLawQuality: z.string().optional(),
    feederReputation: z.string().optional(),
    /** Legacy import key; accepted but not persisted. */
    researchBlob: z.unknown().optional(),
  })
  .strict();

export const financialSchoolSchema = z
  .object({
    name: z.string().min(1),
    publishedCOA: z.number().int().optional(),
    tuition: z.number().int().optional(),
    roomAndBoard: z.number().int().optional(),
    feesAndOther: z.number().int().optional(),
    athleticAidAvailable: z.boolean().optional(),
  })
  .strict();

export const scorecardSchoolSchema = z
  .object({
    name: z.string().min(1),
    state: z.string().length(2),
    scorecardId: z.number().int().optional(),
    city: z.string().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    acceptanceRate: z.number().optional(),
    satMid50Low: z.number().int().optional(),
    satMid50High: z.number().int().optional(),
    satMathMid50Low: z.number().int().optional(),
    satMathMid50High: z.number().int().optional(),
    satEBRWMid50Low: z.number().int().optional(),
    satEBRWMid50High: z.number().int().optional(),
    enrollmentSize: z.number().int().optional(),
    setting: z.string().optional(),
    retentionRate: z.number().optional(),
    gradRate4Year: z.number().optional(),
    studentFacultyRatio: z.number().optional(),
    dataCollectedAt: z.string().optional(),
    publishedCOA: z.number().int().optional(),
    averageAnnualCost: z.number().int().optional(),
    tuition: z.number().int().optional(),
    roomAndBoard: z.number().int().optional(),
    feesAndOther: z.number().int().optional(),
  })
  .strict();

export const schoolImportEnvelopeSchema = z.discriminatedUnion("source", [
  z.object({
    source: z.literal("swimcloud"),
    collectedAt: z.string(),
    stats: swimcloudImportStatsSchema,
    schools: z.array(swimcloudSchoolSchema),
  }),
  z.object({
    source: z.literal("school_research"),
    collectedAt: z.string(),
    schools: z.array(researchSchoolSchema),
  }),
  z.object({
    source: z.literal("financial"),
    collectedAt: z.string(),
    schools: z.array(financialSchoolSchema),
  }),
  z.object({
    source: z.literal("scorecard"),
    collectedAt: z.string(),
    schools: z.array(scorecardSchoolSchema),
  }),
]);

export type SchoolImportEnvelope = z.infer<typeof schoolImportEnvelopeSchema>;
export type ScorecardSchoolRow = z.infer<typeof scorecardSchoolSchema>;
