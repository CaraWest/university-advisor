/**
 * College Scorecard `school.name` often differs from our seed `School.name`. Most cases are
 * handled in `normalizeForScorecardMatch` (leading "The", `&`, branch-campus suffixes, etc.).
 * This file lists **explicit** alternate display strings when normalization is still not enough.
 *
 * Search/query fallbacks: `SCORECARD_EXTRA_SEARCH_QUERIES` run only after the canonical name
 * returns zero post-filter matches, and never after an ambiguous multi-match.
 */

/** When the API uses a different official title than our seed, list it here (exact `School.name` key). */
export const SCORECARD_MATCH_LABELS: Record<string, readonly string[]> = {
  "Notre Dame University": ["University of Notre Dame"],
  "Columbia University": ["Columbia University in the City of New York"],
  "Hobart and William Smith Colleges": ["Hobart William Smith Colleges"],
  "Sewanee — University of the South": ["The University of the South"],
  "Virginia Tech": ["Virginia Polytechnic Institute and State University"],
};

/** Broader `school.name` filters to try second — only when the tighter name yields no unique hit. */
export const SCORECARD_EXTRA_SEARCH_QUERIES: Record<string, readonly string[]> = {
  "Wheaton College": ["Wheaton"],
  // API name filter can miss ampersand variants; branch title uses spaced "A & M".
  "Texas A&M University": ["Texas A & M University", "Texas A & M"],
  // Scorecard omits "and"; em dash in seed can weaken the primary search.
  "Hobart and William Smith Colleges": ["Hobart William Smith Colleges"],
  "Sewanee — University of the South": ["University of the South", "Sewanee"],
};

export function scorecardMatchLabels(dbName: string): string[] {
  const extra = SCORECARD_MATCH_LABELS[dbName] ?? [];
  return [dbName, ...extra];
}

export function scorecardSearchQuerySequence(dbName: string): string[] {
  const extra = SCORECARD_EXTRA_SEARCH_QUERIES[dbName] ?? [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const q of [dbName, ...extra]) {
    if (seen.has(q)) continue;
    seen.add(q);
    out.push(q);
  }
  return out;
}
