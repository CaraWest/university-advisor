import { z } from "zod";

export const swimcloudScorecardMapEntrySchema = z.object({
  scorecardId: z.number().int().positive(),
  swimcloudTeamId: z.number().int().positive(),
  note: z.string().optional(),
});

export const swimcloudScorecardMapSchema = z.array(swimcloudScorecardMapEntrySchema);

export type SwimcloudScorecardMapEntry = z.infer<typeof swimcloudScorecardMapEntrySchema>;
