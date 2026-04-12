import type { z } from "zod";

import { swimcloudSchoolSchema } from "@/lib/validation/import-envelope";

export type SwimcloudSchoolRow = z.infer<typeof swimcloudSchoolSchema>;

/** True when the row likely came from a real how-do-i-fit parse (not URL/name-only metadata). */
export function swimcloudRowHasFitMetrics(row: SwimcloudSchoolRow): boolean {
  return (
    row.matchScore != null ||
    row.teamPowerIndexAvg != null ||
    row.rosterSize != null ||
    row.abigailRank != null
  );
}
