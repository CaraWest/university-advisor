import type { AcademicProfile, School, SwimData } from "@prisma/client";
import type { StudentProfile } from "@/lib/types/student-profile";

type JsonValue = string | number | boolean | null | JsonObject | JsonValue[];
type JsonObject = { [k: string]: JsonValue };

/** Drop null, undefined, empty strings, and empty nested objects. Dates → ISO string. */
export function pruneFacts(value: unknown): unknown {
  if (value === null || value === undefined) return undefined;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") {
    return value.trim() === "" ? undefined : value;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    const arr = value.map(pruneFacts).filter((v) => v !== undefined);
    return arr.length ? arr : undefined;
  }
  if (typeof value === "object") {
    const out: JsonObject = {};
    for (const [k, v] of Object.entries(value)) {
      const p = pruneFacts(v);
      if (p !== undefined) out[k] = p as JsonValue;
    }
    return Object.keys(out).length ? out : undefined;
  }
  return undefined;
}

function pickSchoolForPrompt(school: School): JsonObject {
  const row: JsonObject = {
    name: school.name,
    state: school.state,
    institutionType: school.institutionType,
  };
  if (school.city != null) row.city = school.city;
  if (school.scorecardId != null) row.scorecardId = school.scorecardId;
  if (school.latitude != null && school.longitude != null) {
    row.latitude = school.latitude;
    row.longitude = school.longitude;
  }
  if (school.distanceFromHome != null) row.distanceFromHomeMiles = school.distanceFromHome;
  return row;
}

const SWIM_OMIT = new Set([
  "id",
  "schoolId",
  "createdAt",
  "updatedAt",
  "importSnapshotJson",
]);

function swimForPrompt(swim: SwimData): JsonObject {
  const out: JsonObject = {};
  for (const [k, v] of Object.entries(swim)) {
    if (SWIM_OMIT.has(k)) continue;
    out[k] = v as JsonValue;
  }
  return out;
}

const ACADEMIC_OMIT = new Set(["id", "schoolId", "createdAt", "updatedAt"]);

function academicForPrompt(a: AcademicProfile): JsonObject {
  const out: JsonObject = {};
  for (const [k, v] of Object.entries(a)) {
    if (ACADEMIC_OMIT.has(k)) continue;
    out[k] = v as JsonValue;
  }
  return out;
}

/** Schema/metadata omitted from the prompt JSON; `studyAbroadProfile` stays included. Only `writingProfile` is excluded as user long-form prose. */
const PROFILE_OMIT = new Set(["id", "createdAt", "updatedAt", "writingProfile"]);

function profileForPrompt(profile: StudentProfile): JsonObject {
  const out: JsonObject = {};
  for (const [k, v] of Object.entries(profile)) {
    if (PROFILE_OMIT.has(k)) continue;
    out[k] = v as JsonValue;
  }
  return out;
}

/**
 * Context for AI summary per data spec + phase 5 exclusions (no financials, contacts, tagging, notes, deadlines).
 */
export function buildSchoolSummaryContext(
  school: School,
  swim: SwimData | null,
  academic: AcademicProfile | null,
  profile: StudentProfile | null = null,
): JsonObject {
  const payload: JsonObject = {};
  if (profile) {
    const pruned = pruneFacts(profileForPrompt(profile)) as JsonObject | undefined;
    if (pruned && Object.keys(pruned).length > 0) {
      payload.studentProfile = pruned;
    }
  }
  payload.school = pickSchoolForPrompt(school);
  if (swim) payload.swimData = swimForPrompt(swim);
  if (academic) payload.academicProfile = academicForPrompt(academic);
  const pruned = pruneFacts(payload) as JsonObject | undefined;
  return pruned ?? {};
}

function buildIntroductionParagraph(profile: StudentProfile | null): string {
  if (!profile) {
    return "You are researching a university for a high school student named Abigail. She is a competitive swimmer, has strong academics, is deeply interested in studying abroad, wants a program in international relations or something adjacent, and is tentatively considering law school. Her primary major is undiscovered — she is still exploring what she wants to do.";
  }

  const traits: string[] = [];

  if (profile.powerIndex != null) {
    traits.push(`a competitive swimmer (SwimCloud Power Index: ${profile.powerIndex})`);
  } else {
    traits.push("a competitive swimmer");
  }

  if (profile.gpa != null) {
    traits.push(`a ${profile.gpa} GPA`);
  }

  if (profile.satComposite != null) {
    const parts = [`SAT composite ${profile.satComposite}`];
    if (profile.satMath != null) parts.push(`Math ${profile.satMath}`);
    if (profile.satEBRW != null) parts.push(`EBRW ${profile.satEBRW}`);
    traits.push(parts.join(", "));
  } else if (profile.satMath != null || profile.satEBRW != null) {
    const parts: string[] = [];
    if (profile.satMath != null) parts.push(`SAT Math ${profile.satMath}`);
    if (profile.satEBRW != null) parts.push(`SAT EBRW ${profile.satEBRW}`);
    traits.push(parts.join(", "));
  }

  const acadLine = traits.length > 1 ? traits.slice(1).join(", ") : "strong academics";

  let intro = `You are researching a university for a high school student named Abigail. She is ${traits[0]}, has ${acadLine}, is deeply interested in studying abroad, wants a program in international relations or something adjacent, and is tentatively considering law school. Her primary major is undiscovered — she is still exploring what she wants to do.`;

  const extras: string[] = [];
  if (profile.divisionPreference) extras.push(`Division preference: ${profile.divisionPreference}.`);
  if (profile.sizePreference) extras.push(`School size preference: ${profile.sizePreference}.`);
  if (profile.geographyNotes) extras.push(`Geography notes: ${profile.geographyNotes}.`);
  if (profile.graduationYear != null) extras.push(`Graduation year: ${profile.graduationYear}.`);

  if (extras.length > 0) {
    intro += `\n\nAdditional context about Abigail: ${extras.join(" ")}`;
  }

  return intro;
}

export function buildSummaryInstruction(profile: StudentProfile | null = null): string {
  const intro = buildIntroductionParagraph(profile);

  const piRef = profile?.powerIndex != null
    ? `How would Abigail fit on this roster based on her Power Index of ${profile.powerIndex}?`
    : "How would Abigail fit on this roster based on her Power Index (see structured data)?";

  return `${intro}

You will be given structured data already collected about this school. Use it as your foundation, but do not limit yourself to it. Search the web to fill gaps, find specifics, and surface anything distinctive that would help Abigail and her parent make a real decision about this school.

Before you write, apply these reality-check rules. Do not create a separate "concerns" section — weave these observations into the relevant paragraphs where the context is live:

Athletic triage: Before writing, assess whether swimming is a realistic path at this school based on the Power Index gap and athletic tier in the structured data. Apply the following logic:
- If her athletic tier is "Recruit target" — lead with the swim program. Athletic fit is a primary reason to consider this school and should be the first substantive section.
- If her athletic tier is "Walk-on possible" — mention swimming briefly and honestly in one short paragraph. Do not lead with it. The academic and program case should carry the summary.
- If her athletic tier is "Below threshold", or no swim data exists, or the Power Index gap makes a walk-on implausible — do not lead with swimming and do not give it a full section. Open with one or two sentences acknowledging that competitive swimming is not a realistic path here, then pivot immediately to why the school is or isn't a strong fit on academics, study abroad, law school outcomes, and campus culture. The remainder of the summary should read as if swimming is not part of the picture.
Do not fabricate athletic fit that does not exist. Do not soften "below threshold" into "challenging but possible." If she is not swimming there, say so plainly and move on.

Admissions fit: Compare Abigail's SAT composite and section scores against the school's mid-50% range from the structured data. If she is below the 25th percentile, say so plainly and note what it means — she is a reach candidate on academics and will need her application to be exceptional in other dimensions. Do not soften this. If her Power Index makes her a recruit target at this school, note explicitly that athletic recruiting interest may help offset an academic reach. If she is walk-on possible only, note that she cannot count on athletic leverage in admissions.

Cost: If published COA is available in the structured data, state the annual cost. Note whether the school meets full demonstrated need, offers merit aid, or neither. At household incomes above $200k, need-based aid is unlikely at most private institutions — say so. If COA exceeds $70,000/year and no merit aid pathway is evident, flag it as a significant financial consideration that warrants investigation.

Athletic scholarships: If the school is Division III or NAIA, state clearly that athletic scholarships are not available under NCAA rules. Do not omit this even if it seems obvious.

Study abroad and swim season conflict: If study abroad is important to Abigail based on her profile, and the school has a competitive swim season spanning both fall and spring, flag the conflict explicitly. Recommend she ask the coach directly whether swimmers have successfully completed semester-long programs abroad and which semester is realistic.

Research and write a one-pager covering:

The swim program — What is the team culture, coaching tenure, and competitive level? ${piRef} Use the structured data provided and fill in anything missing from SwimCloud or the school's athletics site.

The IR or adjacent program — What does this school actually offer? Is there a named school or center? What makes it distinctive or weak? Who teaches it? Are there research centers, practitioner faculty, or notable alumni pathways?

Study abroad — Be specific. What programs exist, where do students go, what percentage participate, and is international experience embedded in the curriculum or just available as an option?

Study abroad fit — Based on Abigail's study abroad profile and interests, how well does this school's program match what she is looking for? Reference specific programs, participation rates, owned vs. affiliated programs, and destinations if available. Flag clearly if there is a meaningful mismatch.

Law school outcomes — What is the school's track record placing students in law school? Any T14 placements? How is the pre-law advising described by students and alumni?

Campus culture and fit — What is this school actually like to attend? What kind of student thrives here? Anything distinctive about the environment, values, or community that would matter to a curious, internationally-minded student-athlete?

Bottom line — Two or three sentences. What is the most compelling reason Abigail should look closely at this school, and what is the biggest open question she should investigate further?

Write clearly and directly for a high school student and her parent reading together. Be honest about weaknesses. Do not pad. If you cannot find reliable information on a dimension, say so briefly rather than speculating.

IMPORTANT: Output ONLY the summary content using markdown formatting. Do NOT include any conversational preamble, sign-off, or meta-commentary (e.g. "Here is the summary", "Let me research", "I have gathered…", "Let me compile…", or any description of what you will write next). Start directly with the substance — typically a ## heading and facts.`;
}

/** @deprecated Use buildSummaryInstruction() instead. Kept for backward compatibility. */
export const DEFAULT_SUMMARY_INSTRUCTION = buildSummaryInstruction(null);

export function contextJsonForPrompt(
  school: School,
  swim: SwimData | null,
  academic: AcademicProfile | null,
  profile: StudentProfile | null = null,
): string {
  const ctx = buildSchoolSummaryContext(school, swim, academic, profile);
  return JSON.stringify(ctx, null, 2);
}
