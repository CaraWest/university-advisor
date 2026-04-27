import { z } from "zod";

export const SCHOOL_STATUSES = [
  "None",
  "Shortlisted",
  "Applying",
  "Accepted",
  "Rejected",
] as const;

export const REJECTION_REASONS = [
  "Athletic mismatch",
  "Academic mismatch",
  "Financial",
  "Program fit",
  "No swim team",
  "Abigail preference",
  "Parent preference",
] as const;

export const INSTITUTION_TYPES = [
  "Research-HighSelectivity",
  "Research-IRFocus",
  "Research-LargePublic",
  "LAC-HighlySelective",
  "LAC-IRFocus",
  "WomensCollege",
] as const;

/** Manual / editable financial fields on PATCH (COA and import flags stay on the row until import changes them). */
export const financialModelPatchSchema = z
  .object({
    estimatedMeritAid: z.number().int().min(0).nullable().optional(),
    estimatedAthleticAid: z.number().int().min(0).nullable().optional(),
    needAidLikely: z.boolean().nullable().optional(),
    financialNotes: z.string().nullable().optional(),
  })
  .strict();

export type FinancialModelPatchInput = z.infer<typeof financialModelPatchSchema>;

export const schoolPatchSchema = z
  .object({
    status: z.enum(SCHOOL_STATUSES).optional(),
    rejectionReason: z.enum(REJECTION_REASONS).nullable().optional(),
    notes: z.string().nullable().optional(),
    abigailFavorite: z.boolean().optional(),
    interested: z.boolean().optional(),
    email: z.boolean().optional(),
    phoneCall: z.boolean().optional(),
    campusVisit: z.boolean().optional(),
    financialModel: financialModelPatchSchema.optional(),
  })
  .strict();

export type SchoolPatchInput = z.infer<typeof schoolPatchSchema>;

export type SchoolStatus = (typeof SCHOOL_STATUSES)[number];

export const schoolCreateSchema = z
  .object({
    name: z.string().min(1),
    state: z.string().min(1),
    city: z.string().nullable().optional(),
    scorecardId: z.number().int().positive(),
    latitude: z.number().nullable().optional(),
    longitude: z.number().nullable().optional(),
    ownership: z.number().int().optional(),
    swimcloudUrl: z.string().url().nullable().optional(),
  })
  .strict();

export type SchoolCreateInput = z.infer<typeof schoolCreateSchema>;

/** Parses `?status=` for the schools list; invalid values are ignored (show all). */
export function parseSchoolListStatusFilter(
  raw: string | string[] | undefined,
): SchoolStatus | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v == null || v === "") {
    return null;
  }
  return (SCHOOL_STATUSES as readonly string[]).includes(v) ? (v as SchoolStatus) : null;
}
