/** Round Rock, TX — per data spec §4 */
export const ROUND_ROCK_LAT = 30.5083;
export const ROUND_ROCK_LON = -97.6789;

const HOME_LAT = ROUND_ROCK_LAT;
const HOME_LON = ROUND_ROCK_LON;

const R = 3958.8; // Earth radius in miles

function toRad(d: number): number {
  return (d * Math.PI) / 180;
}

/** Great-circle distance in miles between two WGS84 points. */
export function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function distanceMilesFromRoundRock(latitude: number, longitude: number): number {
  return haversineMiles(HOME_LAT, HOME_LON, latitude, longitude);
}

/** SwimCloud team average power index — recruit target band (import / spec §2.2 / §4). */
export const TEAM_POWER_INDEX_RECRUIT_TARGET_MIN = 35;

/** SwimCloud team average power index — walk-on possible band lower bound. */
export const TEAM_POWER_INDEX_WALKON_MIN = 20;

export type ProspectChancesLevel = "Low" | "Medium" | "High";

/** Maps stored `athleticTier` strings (from import) to display level. */
export function prospectChancesFromAthleticTier(
  athleticTier: string | null | undefined,
): ProspectChancesLevel | null {
  if (athleticTier === "Recruit target") return "High";
  if (athleticTier === "Walk-on possible") return "Medium";
  if (athleticTier === "Below threshold") return "Low";
  return null;
}

/** Tooltip copy for Prospect Chances; uses the same thresholds as `athleticTierFromTeamPowerIndex`. */
export function prospectChancesExplainer(): string {
  const hi = TEAM_POWER_INDEX_RECRUIT_TARGET_MIN;
  const lo = TEAM_POWER_INDEX_WALKON_MIN;
  const medUpper = hi - 1;
  return [
    "Derived from the SwimCloud team average power index at import time.",
    "",
    `High: index ≥ ${hi} (recruit target).`,
    `Medium: index ${lo}–${medUpper} (walk-on possible).`,
    `Low: index below ${lo} (below threshold).`,
  ].join("\n");
}

/** Spec §2.2 / §4 — from team average power index; no upper cap on “Recruit target”. */
export function athleticTierFromTeamPowerIndex(teamPowerIndexAvg: number): string {
  if (teamPowerIndexAvg >= TEAM_POWER_INDEX_RECRUIT_TARGET_MIN) return "Recruit target";
  if (teamPowerIndexAvg >= TEAM_POWER_INDEX_WALKON_MIN) return "Walk-on possible";
  return "Below threshold";
}

/** SwimCloud and other sources use "Division 1" / Roman numerals; map to DI/DII/DIII for aid rules. */
function canonicalNcaaDivisionForAthleticAid(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase().replace(/\s+/g, " ");
  const word = /^division\s*([123]|i{1,3})$/i.exec(lower);
  if (word) {
    const g = word[1].toLowerCase();
    if (g === "1" || g === "i") return "DI";
    if (g === "2" || g === "ii") return "DII";
    if (g === "3" || g === "iii") return "DIII";
  }
  const compact = lower.replace(/\s/g, "");
  if (compact === "di" || compact === "d1") return "DI";
  if (compact === "dii" || compact === "d2") return "DII";
  if (compact === "diii" || compact === "d3") return "DIII";
  if (compact === "naia") return "NAIA";
  if (trimmed === "DI" || trimmed === "DII" || trimmed === "DIII" || trimmed === "NAIA") return trimmed;
  return null;
}

/** Spec — DI/DII may offer athletic aid; DIII/NAIA may not (includes SwimCloud "Division N" labels). */
export function athleticAidAvailableFromDivision(
  ncaaDivision: string | null | undefined,
): boolean | null {
  if (ncaaDivision == null || ncaaDivision === "") return null;
  const canon = canonicalNcaaDivisionForAthleticAid(ncaaDivision);
  if (canon == null) return null;
  if (canon === "DI" || canon === "DII") return true;
  if (canon === "DIII" || canon === "NAIA") return false;
  return null;
}

/**
 * Spec: publishedCOA − estimatedMeritAid − estimatedAthleticAid (annual).
 * When athletic aid is not available for the program, athletic aid is treated as 0.
 */
export function deriveEstimatedNetCost(input: {
  publishedCOA: number | null | undefined;
  estimatedMeritAid: number | null | undefined;
  estimatedAthleticAid: number | null | undefined;
  athleticAidAvailable: boolean | null | undefined;
}): number | null {
  const coa = input.publishedCOA;
  if (coa == null) return null;
  const merit = input.estimatedMeritAid ?? 0;
  const athleticEffective =
    input.athleticAidAvailable === false ? 0 : (input.estimatedAthleticAid ?? 0);
  return coa - merit - athleticEffective;
}

export function deriveFourYearEstimate(estimatedNetCost: number | null | undefined): number | null {
  if (estimatedNetCost == null) return null;
  return estimatedNetCost * 4;
}
