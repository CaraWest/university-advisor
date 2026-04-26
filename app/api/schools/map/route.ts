import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requireAuthSession } from "@/lib/require-auth";
import type { SchoolMapRow } from "@/lib/types/school-map";

export type { SchoolMapRow };

export async function GET() {
  const auth = await requireAuthSession();
  if (!auth.ok) return auth.response;

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
      abigailFavorite: true,
      interested: true,
      phoneCall: true,
      campusVisit: true,
      swimData: { select: { athleticTier: true } },
      _count: { select: { emailDomains: true, gmailLinks: true } },
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
    abigailFavorite: r.abigailFavorite,
    interested: r.interested,
    phoneCall: r.phoneCall,
    campusVisit: r.campusVisit,
    hasEmails: r._count.emailDomains > 0 || r._count.gmailLinks > 0,
  }));

  return NextResponse.json(payload);
}
