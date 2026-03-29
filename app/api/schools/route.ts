import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { SchoolListRow } from "@/lib/types/school-list";

export type { SchoolListRow };

export async function GET() {
  const rows = await prisma.school.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      state: true,
      city: true,
      institutionType: true,
      lifecycleStatus: true,
      updatedAt: true,
    },
  });

  const payload: SchoolListRow[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    state: r.state,
    city: r.city,
    institutionType: r.institutionType,
    lifecycleStatus: r.lifecycleStatus,
    updatedAt: r.updatedAt.toISOString(),
  }));

  return NextResponse.json(payload);
}
