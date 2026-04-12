/** Parse SwimCloud team id from a team page or fit URL. */
const SWIMCLOUD_TEAM_PATH = /swimcloud\.com\/team\/(\d+)/i;

export function parseSwimcloudTeamIdFromUrl(url: string | null | undefined): number | undefined {
  if (url == null || typeof url !== "string") return undefined;
  const m = url.trim().match(SWIMCLOUD_TEAM_PATH);
  if (!m) return undefined;
  const n = Number(m[1]);
  if (Number.isInteger(n) && n > 0) return n;
  return undefined;
}

export function swimcloudTeamCanonicalUrl(teamId: number): string {
  return `https://www.swimcloud.com/team/${teamId}/`;
}

export type SwimDataLikeForTeamId = {
  swimcloudTeamId: number | null;
  swimcloudUrl: string | null;
  importSnapshotJson: string | null;
};

/** Backfill / repair: column, then URL, then import snapshot JSON keys. */
export function effectiveSwimcloudTeamIdForSwimDataRow(row: SwimDataLikeForTeamId): number | undefined {
  if (row.swimcloudTeamId != null) {
    const n = Number(row.swimcloudTeamId);
    if (Number.isInteger(n) && n > 0) return n;
  }
  const fromUrl = parseSwimcloudTeamIdFromUrl(row.swimcloudUrl);
  if (fromUrl != null) return fromUrl;
  const raw = row.importSnapshotJson;
  if (raw != null && raw.trim().length > 0) {
    try {
      const j = JSON.parse(raw) as Record<string, unknown>;
      const st = j.scrapeTeamId;
      const stN = typeof st === "number" ? st : typeof st === "string" ? Number(st) : NaN;
      if (Number.isInteger(stN) && stN > 0) return stN;
      const tid = j.swimcloudTeamId;
      const tidN = typeof tid === "number" ? tid : typeof tid === "string" ? Number(tid) : NaN;
      if (Number.isInteger(tidN) && tidN > 0) return tidN;
    } catch {
      /* invalid snapshot */
    }
  }
  return undefined;
}
