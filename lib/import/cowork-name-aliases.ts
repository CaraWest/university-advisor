/**
 * Normalizes a school name for matching: NFKC, trim,
 * collapse internal whitespace, unify common dash characters to ASCII hyphen, lowercase.
 */
export function normalizeImportSchoolName(raw: string): string {
  let s = raw.normalize("NFKC").trim();
  s = s.replace(/\s+/g, " ");
  s = s.replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g, "-");
  return s.toLowerCase();
}

/**
 * After normalizeImportSchoolName, map alternate spellings to the exact `School.name`
 * string stored in the DB. Keys must be normalized with normalizeImportSchoolName.
 *
 * Expand only when an import source consistently uses a different label —
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
  "st olaf college": "St. Olaf College",

  // William & Mary
  "william and mary": "William & Mary",

  // University of California (Scorecard / SwimCloud hyphen, no spaces around dash)
  "university of california-berkeley": "University of California — Berkeley",
  "university of california-davis": "University of California — Davis",
  "university of california-los angeles": "University of California — Los Angeles",
  "university of california-san diego": "University of California — San Diego",

  // Sewanee / Miami / Maryland — alternate labels on SwimCloud
  "university of the south (sewanee)": "Sewanee — University of the South",
  "university of miami (florida)": "University of Miami",
  "university of maryland": "University of Maryland — College Park",

  // Claremont consortium combined swim teams
  "claremont mckenna-harvey mudd-scripps colleges": "Claremont McKenna College",
  "claremont-mudd-scripps": "Claremont McKenna College",
  "pomona-pitzer colleges": "Pomona College",

  // SwimCloud disambiguator suffixes
  "trinity college (connecticut)": "Trinity College",
  "wheaton college (massachusetts)": "Wheaton College",
  "king's college (pennsylvania)": "King's College (PA)",

  // Missing separator / qualifier
  "university of colorado boulder": "University of Colorado — Boulder",

  // SwimCloud short campus names → full seed names
  "indiana university": "Indiana University — Bloomington",
  "university of illinois": "University of Illinois — Urbana-Champaign",
  "university of michigan": "University of Michigan — Ann Arbor",
  "university of minnesota": "University of Minnesota — Twin Cities",
  "university of texas": "University of Texas at Austin",
  "university of wisconsin-madison": "University of Wisconsin — Madison",

  // Washington University (Missouri) — SwimCloud label
  "washington university (missouri)": "Washington University in St. Louis",

  // Lewis "and" vs "&"
  "lewis and clark college": "Lewis & Clark College",
};
