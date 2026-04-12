import type { Prisma, School } from "@prisma/client";

import type { SchoolPatchInput } from "@/lib/validation/school";

export type SchoolPatchMergeFailure =
  | { code: "REJECTION_REASON_REQUIRES_REJECTED" }
  | { code: "REJECTION_REASON_REQUIRED" };

/** Applies status / rejection coupling rules and returns Prisma update fields. */
export function mergeSchoolPatch(
  school: Pick<School, "status" | "rejectionReason">,
  patch: SchoolPatchInput,
): { ok: true; prismaData: Prisma.SchoolUpdateInput } | { ok: false; error: SchoolPatchMergeFailure } {
  const { financialModel: _financial, ...schoolPatch } = patch;
  const nextStatus = schoolPatch.status ?? school.status;
  let nextReason = school.rejectionReason;

  if (schoolPatch.status !== undefined && schoolPatch.status !== "Rejected") {
    nextReason = null;
  }

  if (schoolPatch.rejectionReason !== undefined) {
    if (nextStatus !== "Rejected") {
      return { ok: false, error: { code: "REJECTION_REASON_REQUIRES_REJECTED" } };
    }
    nextReason = schoolPatch.rejectionReason;
  } else if (schoolPatch.status === "Rejected") {
    nextReason = school.rejectionReason;
  }

  if (nextStatus === "Rejected" && !nextReason) {
    return { ok: false, error: { code: "REJECTION_REASON_REQUIRED" } };
  }

  const prismaData: Prisma.SchoolUpdateInput = { ...schoolPatch };

  const couplingTouched =
    schoolPatch.status !== undefined || schoolPatch.rejectionReason !== undefined;

  if (couplingTouched) {
    if (schoolPatch.status !== undefined && schoolPatch.status !== "Rejected") {
      prismaData.rejectionReason = null;
    } else {
      prismaData.rejectionReason = nextReason;
    }
  } else {
    delete prismaData.rejectionReason;
  }

  return { ok: true, prismaData };
}
