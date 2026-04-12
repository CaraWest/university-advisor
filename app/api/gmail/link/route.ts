import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requireAuthSession } from "@/lib/require-auth";

export async function POST(request: Request) {
  const auth = await requireAuthSession();
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { gmailMessageId, schoolId, senderEmail, subject } = body as {
    gmailMessageId?: string;
    schoolId?: string;
    senderEmail?: string;
    subject?: string;
  };

  if (!gmailMessageId || !schoolId || !senderEmail) {
    return NextResponse.json(
      { error: "gmailMessageId, schoolId, and senderEmail are required" },
      { status: 400 },
    );
  }

  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { id: true, name: true },
  });
  if (!school) {
    return NextResponse.json({ error: "School not found" }, { status: 404 });
  }

  const link = await prisma.gmailSchoolLink.upsert({
    where: { gmailMessageId },
    create: { gmailMessageId, schoolId, senderEmail, subject: subject ?? null },
    update: { schoolId, senderEmail, subject: subject ?? null },
  });

  return NextResponse.json({
    id: link.id,
    gmailMessageId: link.gmailMessageId,
    school: { id: school.id, name: school.name },
  });
}

export async function DELETE(request: Request) {
  const auth = await requireAuthSession();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const gmailMessageId = searchParams.get("gmailMessageId");

  if (!gmailMessageId) {
    return NextResponse.json(
      { error: "gmailMessageId query param is required" },
      { status: 400 },
    );
  }

  const link = await prisma.gmailSchoolLink.findUnique({
    where: { gmailMessageId },
  });
  if (!link) {
    return NextResponse.json({ error: "Link not found" }, { status: 404 });
  }

  await prisma.gmailSchoolLink.delete({ where: { gmailMessageId } });
  return new NextResponse(null, { status: 204 });
}
