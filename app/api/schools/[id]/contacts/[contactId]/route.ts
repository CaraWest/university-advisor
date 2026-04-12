import { NextResponse } from "next/server";

import { zodErrorResponse } from "@/lib/api/zod-error-response";
import { prisma } from "@/lib/db";
import { coachContactPatchSchema } from "@/lib/validation/coach-contact";

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

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; contactId: string }> | { id: string; contactId: string } },
) {
  const params = await Promise.resolve(context.params);
  const existing = await prisma.coachContact.findFirst({
    where: { id: params.contactId, schoolId: params.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = coachContactPatchSchema.safeParse(body);
  if (!parsed.success) {
    return zodErrorResponse(parsed.error);
  }

  const row = await prisma.coachContact.update({
    where: { id: params.contactId },
    data: parsed.data,
  });

  return NextResponse.json(jsonContact(row));
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; contactId: string }> | { id: string; contactId: string } },
) {
  const params = await Promise.resolve(context.params);
  const existing = await prisma.coachContact.findFirst({
    where: { id: params.contactId, schoolId: params.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  }

  await prisma.coachContact.delete({ where: { id: params.contactId } });
  return new NextResponse(null, { status: 204 });
}
