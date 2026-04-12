import type { SchoolStatus } from "@/lib/validation/school";

export const SCHOOL_STATUS_COUNTS_INVALIDATE_EVENT = "ua-school-status-counts-invalidate";

export type SchoolStatusCountsJson = {
  byStatus: Record<SchoolStatus, number>;
  /** Rows shown on "All schools" (excludes Rejected). */
  allSchools: number;
};

export function invalidateSchoolStatusCounts(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(SCHOOL_STATUS_COUNTS_INVALIDATE_EVENT));
}
