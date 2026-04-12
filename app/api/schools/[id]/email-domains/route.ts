import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> | { id: string } },
) {
  const params = await Promise.resolve(context.params);
  const domains = await prisma.schoolEmailDomain.findMany({
    where: { schoolId: params.id },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(
    domains.map((d) => ({ id: d.id, domain: d.domain, createdAt: d.createdAt })),
  );
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> | { id: string } },
) {
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

  const { domain } = body as { domain?: string };
  if (!domain || typeof domain !== "string") {
    return NextResponse.json({ error: "domain is required" }, { status: 400 });
  }

  const normalized = domain.toLowerCase().trim().replace(/^@/, "");
  if (!normalized || !normalized.includes(".")) {
    return NextResponse.json(
      { error: "Invalid domain format" },
      { status: 400 },
    );
  }

  const existing = await prisma.schoolEmailDomain.findUnique({
    where: { domain: normalized },
  });
  if (existing) {
    return NextResponse.json(
      { error: `Domain "${normalized}" is already assigned to a school` },
      { status: 409 },
    );
  }

  const row = await prisma.schoolEmailDomain.create({
    data: { schoolId: params.id, domain: normalized },
  });

  return NextResponse.json(
    { id: row.id, domain: row.domain, createdAt: row.createdAt },
    { status: 201 },
  );
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> | { id: string } },
) {
  const params = await Promise.resolve(context.params);
  const { searchParams } = new URL(request.url);
  const domainId = searchParams.get("domainId");

  if (!domainId) {
    return NextResponse.json(
      { error: "domainId query param is required" },
      { status: 400 },
    );
  }

  const domain = await prisma.schoolEmailDomain.findFirst({
    where: { id: domainId, schoolId: params.id },
  });
  if (!domain) {
    return NextResponse.json({ error: "Domain not found" }, { status: 404 });
  }

  await prisma.schoolEmailDomain.delete({ where: { id: domainId } });
  return new NextResponse(null, { status: 204 });
}
