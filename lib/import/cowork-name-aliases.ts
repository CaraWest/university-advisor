import type { SeedSchool } from "../../prisma/seed-schools";

/**
 * Normalizes a school name for case-insensitive matching: NFKC, trim,
 * collapse internal whitespace, unify common dash characters to ASCII hyphen, lowercase.
 * Import parsers and the seed lookup must use the same function.
 */
export function normalizeImportSchoolName(raw: string): string {
  let s = raw.normalize("NFKC").trim();
  s = s.replace(/\s+/g, " ");
  s = s.replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g, "-");
  return s.toLowerCase();
}

/**
 * After normalizeImportSchoolName, map alternate spellings to the exact `School.name`
 * string stored in the DB (see prisma/seed-schools.ts). Keys must be normalized
 * with normalizeImportSchoolName.
 *
 * Expand only when Cowork or a source consistently uses a different label —
 * avoid fuzzy matching in code.
 */
export const COWORK_NAME_ALIASES: Record<string, string> = {
  // University of North Carolina — Chapel Hill
  "unc chapel hill": "University of North Carolina — Chapel Hill",
  "unc-chapel hill": "University of North Carolina — Chapel Hill",
  "university of north carolina at chapel hill": "University of North Carolina — Chapel Hill",
  "university of north carolina, chapel hill": "University of North Carolina — Chapel Hill",

  // Washington University in St. Louis
  "washington university in saint louis": "Washington University in St. Louis",
  "wash u": "Washington University in St. Louis",
  "washu": "Washington University in St. Louis",
  "wustl": "Washington University in St. Louis",

  // Sewanee — University of the South
  sewanee: "Sewanee — University of the South",
  "university of the south": "Sewanee — University of the South",
  "sewanee university of the south": "Sewanee — University of the South",

  // Hobart and William Smith Colleges
  "hobart william smith colleges": "Hobart and William Smith Colleges",
  "hobart and william smith college": "Hobart and William Smith Colleges",
  hws: "Hobart and William Smith Colleges",

  // Notre Dame University (markdown / seed canonical; common external name differs)
  "university of notre dame": "Notre Dame University",
  "notre dame": "Notre Dame University",

  // Saint / St. variants
  "st. louis university": "Saint Louis University",
  "st louis university": "Saint Louis University",
  "saint olaf college": "St. Olaf College",
  "st. olaf college": "St. Olaf College",

  // William & Mary
  "william and mary": "William & Mary",
};

export type SeedNameLookup = Map<string, string>;

/** normalized name → exact seed `name` as stored in the database */
export function buildSeedNameLookup(schools: SeedSchool[]): SeedNameLookup {
  const map: SeedNameLookup = new Map();
  for (const row of schools) {
    const key = normalizeImportSchoolName(row.name);
    if (map.has(key)) {
      throw new Error(
        `Duplicate seed name after normalization: "${row.name}" collides with "${map.get(key)}" (key: "${key}")`,
      );
    }
    map.set(key, row.name);
  }
  return map;
}

/**
 * Resolves an import file school name to the canonical seed name, or null if unknown.
 * Unknown names should be logged and skipped — never silently create schools.
 */
export function resolveImportSchoolName(
  raw: string,
  seedLookup: SeedNameLookup,
): string | null {
  const normalizedInput = normalizeImportSchoolName(raw);
  const aliasedCanonical = COWORK_NAME_ALIASES[normalizedInput];
  const key = aliasedCanonical
    ? normalizeImportSchoolName(aliasedCanonical)
    : normalizedInput;
  return seedLookup.get(key) ?? null;
}
