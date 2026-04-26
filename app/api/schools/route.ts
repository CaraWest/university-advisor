import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuthSession } from "@/lib/require-auth";
import { distanceMilesFromRoundRock } from "@/lib/derived";
import { parseSwimcloudTeamIdFromUrl } from "@/lib/swimcloud-team-id";
import type { SchoolListRow } from "@/lib/types/school-list";
import { schoolCreateSchema } from "@/lib/validation/school";

export type { SchoolListRow };

export const dynamic = "force-dynamic";

function ownershipToInstitutionType(ownership: number | undefined): string {
  if (ownership === 2) return "Research-HighSelectivity";
  return "Research-LargePublic";
}

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
      rejectionReason: true,
      latitude: true,
      longitude: true,
      distanceFromHome: true,
      enrichmentComplete: true,
      abigailFavorite: true,
      interested: true,
      phoneCall: true,
      campusVisit: true,
      aiSummary: true,
      updatedAt: true,
      swimData: { select: { athleticTier: true } },
      academicProfile: { select: { satMid50Low: true, satMid50High: true } },
      financialModel: { select: { publishedCOA: true } },
      _count: { select: { emailDomains: true, gmailLinks: true } },
    },
  });

  const profile = await prisma.studentProfile.findFirst({
    select: { satComposite: true },
  });

  const payload: SchoolListRow[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    state: r.state,
    city: r.city,
    institutionType: r.institutionType,
    status: r.status,
    rejectionReason: r.rejectionReason,
    athleticTier: r.swimData?.athleticTier ?? null,
    satAvg:
      r.academicProfile?.satMid50Low != null && r.academicProfile?.satMid50High != null
        ? Math.round((r.academicProfile.satMid50Low + r.academicProfile.satMid50High) / 2)
        : null,
    publishedCOA: r.financialModel?.publishedCOA ?? null,
    distanceFromHome:
      r.distanceFromHome ??
      (r.latitude != null && r.longitude != null
        ? distanceMilesFromRoundRock(r.latitude, r.longitude)
        : null),
    enrichmentComplete: r.enrichmentComplete,
    abigailFavorite: r.abigailFavorite,
    interested: r.interested,
    phoneCall: r.phoneCall,
    campusVisit: r.campusVisit,
    hasEmails: r._count.emailDomains > 0 || r._count.gmailLinks > 0,
    hasAiSummary: Boolean(r.aiSummary?.trim()),
    updatedAt: r.updatedAt.toISOString(),
  }));

  return NextResponse.json({
    schools: payload,
    userSatComposite: profile?.satComposite ?? null,
  });
}

export async function POST(request: Request) {
  const auth = await requireAuthSession();
  if (!auth.ok) return auth.response;

  const body: unknown = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schoolCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const input = parsed.data;

  const existing = await prisma.school.findFirst({
    where: { scorecardId: input.scorecardId },
    select: { id: true, name: true },
  });

  if (existing) {
    return NextResponse.json(
      { id: existing.id, name: existing.name, created: false },
      { status: 200 },
    );
  }

  const distanceFromHome =
    input.latitude != null && input.longitude != null
      ? distanceMilesFromRoundRock(input.latitude, input.longitude)
      : null;

  const swimcloudTeamId = parseSwimcloudTeamIdFromUrl(input.swimcloudUrl);

  const school = await prisma.school.create({
    data: {
      name: input.name,
      state: input.state,
      city: input.city ?? null,
      scorecardId: input.scorecardId,
      institutionType: ownershipToInstitutionType(input.ownership),
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      distanceFromHome,
      status: "None",
      abigailFavorite: false,
      interested: false,
      phoneCall: false,
      campusVisit: false,
    },
  });

  if (swimcloudTeamId != null) {
    await prisma.swimData.create({
      data: {
        schoolId: school.id,
        hasSwimTeam: true,
        notInSwimCloud: false,
        swimcloudTeamId,
        swimcloudUrl: input.swimcloudUrl!,
      },
    });
  }

  return NextResponse.json(
    { id: school.id, name: school.name, created: true },
    { status: 201 },
  );
}
