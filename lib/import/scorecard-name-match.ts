import { normalizeImportSchoolName } from "@/lib/import/cowork-name-aliases";

/**
 * Aligns DB canonical names with College Scorecard `school.name` for equality checks
 * (e.g. em dash vs " at ", hyphenated forms).
 */
export function normalizeForScorecardMatch(raw: string): string {
  let s = normalizeImportSchoolName(raw);
  s = s.replace(/\bsaint\s+/g, "st ");
  s = s.replace(/\bst\.\s*/g, "st ");
  s = s.replace(/\s+at\s+/g, " ");
  s = s.replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D-]+/g, " ");
  // Scorecard often spells "A & M"; seed uses "A&M".
  s = s.replace(/\s*&\s*/g, " and ");
  s = s.replace(/\s+/g, " ").trim();
  // "The University of …" vs "University of …"
  s = s.replace(/^the\s+/, "");
  // Hyphenated branch suffixes become separate tokens after dash replacement, e.g. "main campus".
  s = s.replace(/\s+main campus\s*$/i, "");
  s = s.replace(/\s+college station\s*$/i, "");
  s = s.replace(/\s+pittsburgh campus\s*$/i, "");
  s = s.replace(/\s+seattle campus\s*$/i, "");
  s = s.replace(/\s+knoxville\s*$/i, "");
  s = s.replace(/\s+columbia\s*$/i, ""); // e.g. University of South Carolina-Columbia
  s = s.replace(/\s+of\s+louisiana\s*$/i, ""); // Tulane University of Louisiana
  // Seed disambiguators such as "King's College (PA)"
  s = s.replace(/\s*\([^)]*\)\s*/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}
