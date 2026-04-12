import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import { zodErrorResponse } from "@/lib/api/zod-error-response";
import {
  athleticAidAvailableFromDivision,
  deriveEstimatedNetCost,
  deriveFourYearEstimate,
} from "@/lib/derived";
import { prisma } from "@/lib/db";
import { requireAuthSession } from "@/lib/require-auth";
import { mergeSchoolPatch } from "@/lib/school-patch-merge";
import { schoolPatchSchema } from "@/lib/validation/school";

export const dynamic = "force-dynamic";

const schoolInclude = {
  swimData: true,
  academicProfile: true,
  financialModel: true,
  coachContacts: { orderBy: { date: "desc" as const } },
  _count: { select: { emailDomains: true, gmailLinks: true } },
} as const;

type SchoolDetailPayload = Prisma.SchoolGetPayload<{ include: typeof schoolInclude }>;

function jsonSchool(school: SchoolDetailPayload) {
  const { coachContacts, _count, ...rest } = school;
  return {
    ...rest,
    hasEmails: _count.emailDomains > 0 || _count.gmailLinks > 0,
    coachContacts: coachContacts.map((c) => ({
      id: c.id,
      date: c.date,
      direction: c.direction,
      type: c.type,
      summary: c.summary,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    })),
  };
}

async function fetchSchool(id: string): Promise<SchoolDetailPayload | null> {
  return prisma.school.findUnique({
    where: { id },
    include: schoolInclude,
  });
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> | { id: string } }) {
  const auth = await requireAuthSession();
  if (!auth.ok) return auth.response;

  const params = await Promise.resolve(context.params);
  const school = await fetchSchool(params.id);
  if (!school) {
    return NextResponse.json({ error: "School not found" }, { status: 404 });
  }
  return NextResponse.json(jsonSchool(school));
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> | { id: string } }) {
  const auth = await requireAuthSession();
  if (!auth.ok) return auth.response;

  const params = await Promise.resolve(context.params);
  const school = await prisma.school.findUnique({
    where: { id: params.id },
    select: { id: true, status: true, rejectionReason: true },
  });
  if (!school) {
    return NextResponse.json({ error: "School not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = schoolPatchSchema.safeParse(body);
  if (!parsed.success) {
    return zodErrorResponse(parsed.error);
  }

  const finPatch = parsed.data.financialModel;
  const hasFinancialPatch = finPatch != null && Object.keys(finPatch).length > 0;
  const hasAnyPatch = Object.keys(parsed.data).length > 0;
  if (!hasAnyPatch) {
    return NextResponse.json(
      {
        error: "Validation failed",
        issues: { formErrors: [], fieldErrors: { _: ["At least one field is required"] } },
      },
      { status: 400 },
    );
  }

  const merged = mergeSchoolPatch(school, parsed.data);
  if (!merged.ok) {
    if (merged.error.code === "REJECTION_REASON_REQUIRES_REJECTED") {
      return NextResponse.json(
        {
          error: "Validation failed",
          issues: {
            formErrors: [] as string[],
            fieldErrors: { rejectionReason: ["rejectionReason is only valid when status is Rejected"] },
          },
        },
        { status: 400 },
      );
    }
    return NextResponse.json(
      {
        error: "Validation failed",
        issues: {
          formErrors: [] as string[],
            fieldErrors: { rejectionReason: ["rejectionReason is required when status is Rejected"] },
        },
      },
      { status: 400 },
    );
  }

  const data = Object.fromEntries(
    Object.entries(merged.prismaData).filter(([, v]) => v !== undefined),
  ) as typeof merged.prismaData;

  const hasSchoolFieldUpdates = Object.keys(data).length > 0;
  if (!hasSchoolFieldUpdates && !hasFinancialPatch) {
    return NextResponse.json(
      {
        error: "Validation failed",
        issues: { formErrors: [], fieldErrors: { _: ["At least one field is required"] } },
      },
      { status: 400 },
    );
  }

  let schoolUpdateData: Prisma.SchoolUpdateInput = data;

  if (hasFinancialPatch && finPatch) {
    const existingFin = await prisma.financialModel.findUnique({
      where: { schoolId: params.id },
    });
    const swim = await prisma.swimData.findUnique({
      where: { schoolId: params.id },
      select: { ncaaDivision: true },
    });

    const athleticFromDivision = athleticAidAvailableFromDivision(swim?.ncaaDivision);
    const athleticAidAvailable =
      existingFin?.athleticAidAvailable !== null && existingFin?.athleticAidAvailable !== undefined
        ? existingFin.athleticAidAvailable
        : athleticFromDivision;

    const estimatedMeritAid =
      finPatch.estimatedMeritAid !== undefined
        ? finPatch.estimatedMeritAid
        : (existingFin?.estimatedMeritAid ?? null);
    const estimatedAthleticAid =
      finPatch.estimatedAthleticAid !== undefined
        ? finPatch.estimatedAthleticAid
        : (existingFin?.estimatedAthleticAid ?? null);
    const needAidLikely =
      finPatch.needAidLikely !== undefined ? finPatch.needAidLikely : (existingFin?.needAidLikely ?? null);
    const financialNotes =
      finPatch.financialNotes !== undefined ? finPatch.financialNotes : (existingFin?.financialNotes ?? null);

    if (athleticAidAvailable === false && (estimatedAthleticAid ?? 0) > 0) {
      return NextResponse.json(
        {
          error: "Validation failed",
          issues: {
            formErrors: [] as string[],
            fieldErrors: {
              estimatedAthleticAid: [
                "Athletic aid must be 0 when athletic aid is not available (division or import)",
              ],
            },
          },
        },
        { status: 400 },
      );
    }

    const net = deriveEstimatedNetCost({
      publishedCOA: existingFin?.publishedCOA,
      estimatedMeritAid,
      estimatedAthleticAid,
      athleticAidAvailable,
    });
    if (net !== null && net < 0) {
      return NextResponse.json(
        {
          error: "Validation failed",
          issues: {
            formErrors: [] as string[],
            fieldErrors: {
              estimatedNetCost: ["estimated net cost cannot be negative (aid exceeds published COA)"],
            },
          },
        },
        { status: 400 },
      );
    }

    const fourYear = deriveFourYearEstimate(net);

    const financialWrite = {
      estimatedMeritAid,
      estimatedAthleticAid,
      needAidLikely,
      financialNotes,
      estimatedNetCost: net,
      fourYearEstimate: fourYear,
    };

    schoolUpdateData = {
      ...schoolUpdateData,
      financialModel: {
        upsert: {
          create: { ...financialWrite },
          update: financialWrite,
        },
      },
    };
  }

  const updated = await prisma.school.update({
    where: { id: params.id },
    data: schoolUpdateData,
    include: schoolInclude,
  });

  return NextResponse.json(jsonSchool(updated));
}
