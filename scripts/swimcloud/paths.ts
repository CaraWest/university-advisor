import { existsSync } from "node:fs";
import { join } from "node:path";

/** Resolved path for Playwright storageState JSON (cookies + localStorage). */
export function swimcloudStorageStatePath(cwd: string = process.cwd()): string {
  const fromEnv = process.env.SWIMCLOUD_STORAGE_STATE?.trim();
  if (fromEnv) {
    return fromEnv.startsWith("/") ? fromEnv : join(cwd, fromEnv);
  }
  return join(cwd, ".local", "swimcloud-storage.json");
}

/** Persistent Chrome profile dir (reduces Cloudflare friction vs ephemeral context). */
export function swimcloudBrowserProfilePath(cwd: string = process.cwd()): string {
  const fromEnv = process.env.SWIMCLOUD_BROWSER_PROFILE?.trim();
  if (fromEnv) {
    return fromEnv.startsWith("/") ? fromEnv : join(cwd, fromEnv);
  }
  return join(cwd, ".local", "swimcloud-browser-profile");
}

/** Default "How do I fit" URL for smoke test (CMS; override with SWIMCLOUD_SMOKE_URL). */
export function swimcloudSmokeUrl(): string {
  const u = process.env.SWIMCLOUD_SMOKE_URL?.trim();
  return u && u.length > 0 ? u : "https://www.swimcloud.com/team/261/how-do-i-fit/";
}

/** JSON list of { teamId, name } — default data/swimcloud-targets.json */
export function swimcloudTargetsPath(cwd: string = process.cwd()): string {
  const fromEnv = process.env.SWIMCLOUD_TARGETS?.trim();
  if (fromEnv) {
    return fromEnv.startsWith("/") ? fromEnv : join(cwd, fromEnv);
  }
  return join(cwd, "data", "swimcloud-targets.json");
}

/**
 * `file` — SWIMCLOUD_TARGETS / data/swimcloud-targets.json
 * `db` — School rows with scorecardId + SwimData.swimcloudTeamId + notInSwimCloud false (after map / backfill)
 * `auto` (default when unset) — file if default targets path exists, else db
 */
export type SwimcloudTargetsSource = "file" | "db" | "auto";

export function swimcloudTargetsSource(cwd: string = process.cwd()): Exclude<SwimcloudTargetsSource, "auto"> {
  const s = process.env.SWIMCLOUD_TARGETS_SOURCE?.trim().toLowerCase();
  if (s === "file") return "file";
  if (s === "db") return "db";
  return existsSync(swimcloudTargetsPath(cwd)) ? "file" : "db";
}
