import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

import { prisma } from "@/lib/db";
import { requireAuthSession } from "@/lib/require-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const SCORECARD_BASE =
  "https://api.data.gov/ed/collegescorecard/v1/schools.json";

const SCORECARD_FIELDS = [
  "id",
  "school.name",
  "school.ownership",
  "latest.admissions.sat_scores.25th_percentile.math",
  "latest.admissions.sat_scores.25th_percentile.critical_reading",
  "latest.admissions.sat_scores.75th_percentile.math",
  "latest.admissions.sat_scores.75th_percentile.critical_reading",
  "latest.student.demographics.student_faculty_ratio",
  "latest.cost.net_price.public.by_income_level.110001-plus",
  "latest.cost.net_price.private.by_income_level.110001-plus",
  "latest.cost.avg_net_price.overall",
  "latest.cost.attendance.academic_year",
  "latest.cost.tuition.out_of_state",
  "latest.cost.tuition.program_year",
].join(",");

type ScorecardRow = Record<string, unknown>;

function n(r: ScorecardRow, k: string): number | null {
  const v = r[k];
  if (v === null || v === undefined) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return null;
}

// ── Job 1: College Scorecard ──────────────────────────────────────────────────

async function jobScorecard(school: {
  id: string;
  name: string;
  state: string;
  scorecardId: number | null;
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.SCORECARD_API_KEY?.trim();
  if (!apiKey) return { ok: false, error: "SCORECARD_API_KEY not configured" };

  try {
    const url = new URL(SCORECARD_BASE);
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("fields", SCORECARD_FIELDS);
    url.searchParams.set("per_page", "5");

    if (school.scorecardId) {
      url.searchParams.set("id", String(school.scorecardId));
    } else {
      url.searchParams.set("school.name", school.name);
      url.searchParams.set("school.state", school.state);
    }

    const res = await fetch(url);
    if (!res.ok) {
      return { ok: false, error: `Scorecard HTTP ${res.status}` };
    }

    const data = (await res.json()) as { results?: ScorecardRow[] };
    const row = data.results?.[0];
    if (!row) {
      return { ok: false, error: "No Scorecard results" };
    }

    const sfr = n(row, "latest.student.demographics.student_faculty_ratio");
    const studentFacultyRatio = sfr !== null ? Math.round(sfr) : null;

    const ownership = n(row, "school.ownership");
    const isPublic = ownership === 1;

    const netPriceField = isPublic
      ? "latest.cost.net_price.public.by_income_level.110001-plus"
      : "latest.cost.net_price.private.by_income_level.110001-plus";
    const avgNetCostHighIncome = n(row, netPriceField);

    const averageAnnualCostOverall = n(row, "latest.cost.avg_net_price.overall");

    const publishedCOA = n(row, "latest.cost.attendance.academic_year");
    const tuitionOOS = n(row, "latest.cost.tuition.out_of_state");
    const tuitionPY = n(row, "latest.cost.tuition.program_year");
    const tuition =
      tuitionOOS !== null
        ? Math.round(tuitionOOS)
        : tuitionPY !== null
          ? Math.round(tuitionPY)
          : null;

    const satMathLow = n(row, "latest.admissions.sat_scores.25th_percentile.math");
    const satMathHigh = n(row, "latest.admissions.sat_scores.75th_percentile.math");
    const satEBRWLow = n(row, "latest.admissions.sat_scores.25th_percentile.critical_reading");
    const satEBRWHigh = n(row, "latest.admissions.sat_scores.75th_percentile.critical_reading");
    const satMid50Low =
      satMathLow !== null && satEBRWLow !== null ? Math.round(satMathLow + satEBRWLow) : null;
    const satMid50High =
      satMathHigh !== null && satEBRWHigh !== null ? Math.round(satMathHigh + satEBRWHigh) : null;

    const academicUpdate: Record<string, unknown> = {};
    if (studentFacultyRatio !== null) academicUpdate.studentFacultyRatio = studentFacultyRatio;
    if (satMid50Low !== null) academicUpdate.satMid50Low = satMid50Low;
    if (satMid50High !== null) academicUpdate.satMid50High = satMid50High;
    if (satMathLow !== null) academicUpdate.satMathMid50Low = Math.round(satMathLow);
    if (satMathHigh !== null) academicUpdate.satMathMid50High = Math.round(satMathHigh);
    if (satEBRWLow !== null) academicUpdate.satEBRWMid50Low = Math.round(satEBRWLow);
    if (satEBRWHigh !== null) academicUpdate.satEBRWMid50High = Math.round(satEBRWHigh);

    if (Object.keys(academicUpdate).length > 0) {
      await prisma.academicProfile.upsert({
        where: { schoolId: school.id },
        create: { schoolId: school.id, ...academicUpdate },
        update: academicUpdate,
      });
    }

    const finUpdate: Record<string, unknown> = {};
    if (avgNetCostHighIncome !== null)
      finUpdate.avgNetCostHighIncome = Math.round(avgNetCostHighIncome);

    const existingFin = await prisma.financialModel.findUnique({
      where: { schoolId: school.id },
      select: { publishedCOA: true, tuition: true, averageAnnualCost: true },
    });
    if (publishedCOA !== null && !existingFin?.publishedCOA)
      finUpdate.publishedCOA = Math.round(publishedCOA);
    if (tuition !== null && !existingFin?.tuition) finUpdate.tuition = tuition;
    if (averageAnnualCostOverall !== null && !existingFin?.averageAnnualCost)
      finUpdate.averageAnnualCost = Math.round(averageAnnualCostOverall);

    if (Object.keys(finUpdate).length > 0) {
      await prisma.financialModel.upsert({
        where: { schoolId: school.id },
        create: { schoolId: school.id, ...finUpdate },
        update: finUpdate,
      });
    }

    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[enrich] Scorecard error for ${school.name}:`, msg);
    return { ok: false, error: msg };
  }
}

// ── Job 2: Claude web search ──────────────────────────────────────────────────

const CLAUDE_SYSTEM = `You are a research assistant. When asked about a university, use the web_search tool to search the school's official website and other reliable sources. Return ONLY a JSON object with the exact keys specified in the user message—no markdown fences, no explanation, no extra text. If you cannot find reliable information for a field, use null. For swimmingCoachingStaff, use an empty array [] only if there is truly no swimming/diving program or no staff listed on the official athletics site—otherwise include every coach or diving staff member listed for the program (prioritize the women's swimming team page when it is separate from men's).`;

function buildClaudePrompt(schoolName: string): string {
  return `Research ${schoolName} and return a JSON object with these exact keys:

{
  "programLabel": string | null,        // Best-fit label for their International Relations or adjacent program: "IR" | "IS" | "GS" | "PPE" | "PE" | "PS/IR" | "PCS" | "IE". null if none exists.
  "programType": string | null,         // "Standalone major" | "Concentration" | "Minor only". null if no IR-adjacent program.
  "flagshipSchool": string | null,      // Named school or department if one exists, e.g. "Elliott School", "School of Foreign Service"
  "programNotes": string | null,        // 1-2 sentence summary of IR/adjacent program depth
  "studyAbroadLevel": string | null,    // "Core requirement" | "Strong culture" | "Available"
  "studyAbroadNotes": string | null,    // Specific programs or participation rate if found
  "preLawQuality": string | null,       // "Strong" | "Adequate" | "Checkbox"
  "t14Placements": string | null,       // Notable T14 law school placements, e.g. "Regular placements at Columbia, NYU, UVA"
  "feederReputation": string | null,    // "Top feeder" | "Strong" | "Moderate" | "Limited". How well-known the school is as an undergraduate feeder to top law schools.
  "swimmingCoachingStaff": [            // From the official university athletics website only (team roster / staff directory pages). Do not use third-party recruiting directories. Each object: "name" (required string), "title" (string|null), "email" (string|null), "phone" (string|null), "profileUrl" (string|null). Only include contact details exactly as published; use null if not listed. Do not invent emails or phone numbers.
    { "name": string, "title": string | null, "email": string | null, "phone": string | null, "profileUrl": string | null }
  ],
  "swimmingStaffSourceUrl": string | null  // Primary athletics staff or team page URL you used, for audit. null if not found.
}

Search the school's official website for program details, study abroad information, financial aid policies, pre-law advising, law school placement data, and swimming/diving coaching staff on the official athletics site. Return only the JSON object.`;
}

type ClaudeResult = {
  programLabel?: string | null;
  programType?: string | null;
  flagshipSchool?: string | null;
  programNotes?: string | null;
  studyAbroadLevel?: string | null;
  studyAbroadNotes?: string | null;
  preLawQuality?: string | null;
  t14Placements?: string | null;
  feederReputation?: string | null;
  swimmingCoachingStaff?: unknown;
  swimmingStaffSourceUrl?: string | null;
};

function parseClaudeJson(text: string): ClaudeResult | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    try {
      return JSON.parse(fenced[1].trim()) as ClaudeResult;
    } catch {
      /* fall through to brace extraction */
    }
  }

  const braceMatch = text.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    try {
      return JSON.parse(braceMatch[0]) as ClaudeResult;
    } catch {
      return null;
    }
  }

  try {
    return JSON.parse(text.trim()) as ClaudeResult;
  } catch {
    return null;
  }
}

/** Returns JSON array string for SwimData.coachingStaffJson, or null if missing or invalid. */
function coachingStaffJsonFromClaude(parsed: ClaudeResult): string | null {
  const raw = parsed.swimmingCoachingStaff;
  if (!Array.isArray(raw) || raw.length === 0) return null;

  const out: Record<string, unknown>[] = [];
  for (const item of raw) {
    if (item === null || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const name = o.name;
    if (typeof name !== "string" || name.trim() === "") continue;

    const row: Record<string, unknown> = { name: name.trim() };
    for (const key of ["title", "email", "phone", "profileUrl"] as const) {
      const v = o[key];
      if (typeof v === "string" && v.trim() !== "") row[key] = v.trim();
      else row[key] = null;
    }
    out.push(row);
  }

  if (out.length === 0) return null;
  return JSON.stringify(out);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function jobClaude(school: {
  id: string;
  name: string;
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return { ok: false, error: "ANTHROPIC_API_KEY not configured" };

  const maxAttempts = 4;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await _callClaude(apiKey, school);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isRateLimit = msg.includes("429") || msg.includes("rate_limit");
      if (isRateLimit && attempt < maxAttempts) {
        const backoff = 60_000 * attempt;
        console.warn(
          `[enrich] Rate limited for ${school.name}, retrying in ${backoff / 1000}s (attempt ${attempt}/${maxAttempts})`,
        );
        await sleep(backoff);
        continue;
      }
      console.error(`[enrich] Claude error for ${school.name}:`, msg);
      return { ok: false, error: msg };
    }
  }
  return { ok: false, error: "Exhausted retries" };
}

async function _callClaude(
  apiKey: string,
  school: { id: string; name: string },
): Promise<{ ok: boolean; error?: string }> {
  const client = new Anthropic({ apiKey });

  const tools: Anthropic.Tool[] = [
    {
      type: "web_search_20250305" as unknown as "custom",
      name: "web_search",
      max_uses: 5,
    } as unknown as Anthropic.Tool,
  ];

  let response = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 4096,
    system: CLAUDE_SYSTEM,
    tools,
    messages: [{ role: "user", content: buildClaudePrompt(school.name) }],
  });

  while (response.stop_reason === "pause_turn") {
    response = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 4096,
      system: CLAUDE_SYSTEM,
      tools,
      messages: [
        { role: "user", content: buildClaudePrompt(school.name) },
        { role: "assistant", content: response.content },
      ],
    });
  }

  const textBlocks = response.content.filter(
    (b): b is Anthropic.TextBlock => b.type === "text",
  );
  if (textBlocks.length === 0) {
    return { ok: false, error: "No text in Claude response" };
  }

  let parsed: ClaudeResult | null = null;
  for (const tb of textBlocks) {
    parsed = parseClaudeJson(tb.text);
    if (parsed) break;
  }
  if (!parsed) {
    const allText = textBlocks.map((b) => b.text).join("\n---\n");
    console.error(`[enrich] Claude JSON parse failed for ${school.name}:`, allText.slice(0, 800));
    return { ok: false, error: "Failed to parse Claude JSON" };
  }

  const academicUpdate: Record<string, unknown> = {};
  for (const key of [
    "programLabel",
    "programType",
    "flagshipSchool",
    "programNotes",
    "studyAbroadLevel",
    "studyAbroadNotes",
    "preLawQuality",
    "t14Placements",
    "feederReputation",
  ] as const) {
    if (parsed[key] !== undefined) academicUpdate[key] = parsed[key];
  }

  if (Object.keys(academicUpdate).length > 0) {
    await prisma.academicProfile.upsert({
      where: { schoolId: school.id },
      create: { schoolId: school.id, ...academicUpdate },
      update: academicUpdate,
    });
  }

  const staffJson = coachingStaffJsonFromClaude(parsed);
  if (staffJson !== null) {
    await prisma.swimData.upsert({
      where: { schoolId: school.id },
      create: {
        schoolId: school.id,
        coachingStaffJson: staffJson,
        hasSwimTeam: true,
      },
      update: { coachingStaffJson: staffJson },
    });
  }

  return { ok: true };
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(
  request: Request,
  context: { params: Promise<{ schoolId: string }> | { schoolId: string } },
) {
  const auth = await requireAuthSession();
  if (!auth.ok) return auth.response;

  const { schoolId } = await Promise.resolve(context.params);
  const { searchParams } = new URL(request.url);
  const skipScorecard = searchParams.get("skipScorecard") === "true";

  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { id: true, name: true, state: true, scorecardId: true },
  });

  if (!school) {
    return NextResponse.json({ error: "School not found" }, { status: 404 });
  }

  let scorecardResult: { ok: boolean; error?: string } = { ok: true, error: "skipped" };
  if (!skipScorecard) {
    scorecardResult = await jobScorecard(school);
    if (!scorecardResult.ok) {
      console.error(
        `[enrich] Scorecard failed for ${school.name}: ${scorecardResult.error}`,
      );
    }
  }

  const claudeResult = await jobClaude(school);
  if (!claudeResult.ok) {
    console.error(
      `[enrich] Claude failed for ${school.name}: ${claudeResult.error}`,
    );
  }

  const allRequired = (skipScorecard || scorecardResult.ok) && claudeResult.ok;
  await prisma.school.update({
    where: { id: schoolId },
    data: { enrichmentComplete: allRequired },
  });

  return NextResponse.json({
    school: school.name,
    scorecard: scorecardResult,
    claude: claudeResult,
    summary: { ok: true, error: "skipped" },
    enrichmentComplete: allRequired,
  });
}
