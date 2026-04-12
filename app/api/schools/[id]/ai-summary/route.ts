import { NextResponse } from "next/server";

import { buildSummaryInstruction, contextJsonForPrompt } from "@/lib/ai/school-summary-context";
import { completeExecutiveSummary, requireAnthropicApiKey } from "@/lib/ai/call-anthropic";
import { prisma } from "@/lib/db";
import { requireAuthSession } from "@/lib/require-auth";

export const maxDuration = 120;

const schoolInclude = {
  swimData: true,
  academicProfile: true,
} as const;

export async function POST(_request: Request, context: { params: Promise<{ id: string }> | { id: string } }) {
  const auth = await requireAuthSession();
  if (!auth.ok) return auth.response;

  const params = await Promise.resolve(context.params);

  if (!requireAnthropicApiKey()) {
    return NextResponse.json(
      { error: "AI summary is not configured (missing ANTHROPIC_API_KEY on the server)." },
      { status: 503 },
    );
  }

  const [school, profile] = await Promise.all([
    prisma.school.findUnique({ where: { id: params.id }, include: schoolInclude }),
    prisma.studentProfile.findFirst(),
  ]);

  if (!school) {
    return NextResponse.json({ error: "School not found" }, { status: 404 });
  }

  const instruction = buildSummaryInstruction(profile);
  const jsonBlock = contextJsonForPrompt(school, school.swimData, school.academicProfile, profile);
  const userMessage = `${instruction}\n\n---\nSchool facts (JSON):\n${jsonBlock}`;

  let summary: string;
  try {
    summary = await completeExecutiveSummary(userMessage);
  } catch (e) {
    console.error("[ai-summary]", e);
    return NextResponse.json(
      { error: "Summary generation failed. Check that ANTHROPIC_API_KEY and ANTHROPIC_MODEL are valid." },
      { status: 502 },
    );
  }

  const generatedAt = new Date();
  const updated = await prisma.school.update({
    where: { id: params.id },
    data: {
      aiSummary: summary,
      summaryGeneratedAt: generatedAt,
    },
    include: {
      swimData: true,
      academicProfile: true,
      financialModel: true,
      coachContacts: { orderBy: { date: "desc" as const } },
    },
  });

  const { coachContacts, ...rest } = updated;
  return NextResponse.json({
    ...rest,
    coachContacts: coachContacts.map((c) => ({
      id: c.id,
      date: c.date,
      direction: c.direction,
      type: c.type,
      summary: c.summary,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    })),
  });
}
