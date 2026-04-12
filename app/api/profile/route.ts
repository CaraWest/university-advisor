import { NextResponse } from "next/server";

import { zodErrorResponse } from "@/lib/api/zod-error-response";
import { prisma } from "@/lib/db";
import { studentProfilePatchSchema } from "@/lib/validation/student-profile";

export const dynamic = "force-dynamic";

const SINGLETON_ID = "singleton";

export async function GET() {
  const profile = await prisma.studentProfile.findFirst();
  return NextResponse.json(profile ?? {});
}

export async function PATCH(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = studentProfilePatchSchema.safeParse(body);
  if (!parsed.success) {
    return zodErrorResponse(parsed.error);
  }

  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json(
      {
        error: "Validation failed",
        issues: { formErrors: [], fieldErrors: { _: ["At least one field is required"] } },
      },
      { status: 400 },
    );
  }

  const existing = await prisma.studentProfile.findFirst();
  const id = existing?.id ?? SINGLETON_ID;

  const profile = await prisma.studentProfile.upsert({
    where: { id },
    create: { id, ...parsed.data },
    update: parsed.data,
  });

  return NextResponse.json(profile);
}
