import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import type { SchoolMapRow } from "@/lib/types/school-map";

export type { SchoolMapRow };

export async function GET() {
  const rows = await prisma.school.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      state: true,
      city: true,
      institutionType: true,
      status: true,
      latitude: true,
      longitude: true,
      distanceFromHome: true,
      swimData: { select: { athleticTier: true } },
    },
  });

  const payload: SchoolMapRow[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    state: r.state,
    city: r.city,
    institutionType: r.institutionType,
    status: r.status,
    latitude: r.latitude,
    longitude: r.longitude,
    distanceFromHome: r.distanceFromHome,
    athleticTier: r.swimData?.athleticTier ?? null,
  }));

  return NextResponse.json(payload);
}
