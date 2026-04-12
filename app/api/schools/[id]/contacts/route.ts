import { NextResponse } from "next/server";

import { zodErrorResponse } from "@/lib/api/zod-error-response";
import { prisma } from "@/lib/db";
import { requireAuthSession } from "@/lib/require-auth";
import { coachContactCreateSchema } from "@/lib/validation/coach-contact";

function jsonContact(c: {
  id: string;
  date: Date;
  direction: string;
  type: string;
  summary: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: c.id,
    date: c.date,
    direction: c.direction,
    type: c.type,
    summary: c.summary,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> | { id: string } },
) {
  const auth = await requireAuthSession();
  if (!auth.ok) return auth.response;

  const params = await Promise.resolve(context.params);
  const school = await prisma.school.findUnique({
    where: { id: params.id },
    select: { id: true },
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

  const parsed = coachContactCreateSchema.safeParse(body);
  if (!parsed.success) {
    return zodErrorResponse(parsed.error);
  }

  const row = await prisma.coachContact.create({
    data: {
      schoolId: params.id,
      date: parsed.data.date,
      direction: parsed.data.direction,
      type: parsed.data.type,
      summary: parsed.data.summary,
    },
  });

  return NextResponse.json(jsonContact(row), { status: 201 });
}
