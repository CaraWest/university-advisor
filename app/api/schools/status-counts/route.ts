import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import type { SchoolStatusCountsJson } from "@/lib/school-status-counts";
import { SCHOOL_STATUSES, type SchoolStatus } from "@/lib/validation/school";

export const dynamic = "force-dynamic";

export async function GET() {
  const [grouped, allSchools] = await Promise.all([
    prisma.school.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.school.count({ where: { NOT: { status: "Rejected" } } }),
  ]);

  const byStatus = Object.fromEntries(SCHOOL_STATUSES.map((s) => [s, 0])) as Record<SchoolStatus, number>;
  for (const row of grouped) {
    if ((SCHOOL_STATUSES as readonly string[]).includes(row.status)) {
      byStatus[row.status as SchoolStatus] = row._count._all;
    }
  }

  const payload: SchoolStatusCountsJson = { byStatus, allSchools };
  return NextResponse.json(payload);
}
