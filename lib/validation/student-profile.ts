import { z } from "zod";

export const DIVISION_PREFERENCES = [
  "No preference",
  "DI",
  "DII",
  "DIII",
  "NAIA",
] as const;

export const SIZE_PREFERENCES = [
  "No preference",
  "Prefer small",
  "Prefer large",
] as const;

export const studentProfilePatchSchema = z
  .object({
    powerIndex: z.number().min(0).nullable().optional(),
    satMath: z.number().int().min(200).max(800).nullable().optional(),
    satEBRW: z.number().int().min(200).max(800).nullable().optional(),
    satComposite: z.number().int().min(400).max(1600).nullable().optional(),
    gpa: z.number().min(0).max(5.0).nullable().optional(),
    graduationYear: z.number().int().min(2020).max(2035).nullable().optional(),
    studyAbroadInterest: z.boolean().optional(),
    divisionPreference: z.enum(DIVISION_PREFERENCES).nullable().optional(),
    sizePreference: z.enum(SIZE_PREFERENCES).nullable().optional(),
    geographyNotes: z.string().nullable().optional(),
    writingProfile: z.string().nullable().optional(),
    studyAbroadProfile: z.string().nullable().optional(),
  })
  .strict();

export type StudentProfilePatchInput = z.infer<typeof studentProfilePatchSchema>;
