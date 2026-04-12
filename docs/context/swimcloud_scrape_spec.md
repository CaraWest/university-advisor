# SwimCloud scrape field mapping

Local scraper: `npm run swimcloud:fetch` (after `npm run swimcloud:auth`). For reliable fit-page DOM and numeric fields, use **`SWIMCLOUD_FETCH_HEADED=1`** or **`npm run swimcloud:fetch:headed`**; headless runs are best-effort and often miss content.

**Targets:** (1) `data/swimcloud-targets.json` when present or `SWIMCLOUD_TARGETS_SOURCE=file`; (2) **`SWIMCLOUD_TARGETS_SOURCE=db`** or **`npm run swimcloud:fetch:db`** — loads schools with **`School.scorecardId`**, **`SwimData.swimcloudTeamId`**, and **`notInSwimCloud`** false (run **`npm run swimcloud:backfill:team-ids`** and/or **`npm run swimcloud:map:sync`** after imports or map curation). See `scripts/swimcloud/paths.ts` (`swimcloudTargetsSource`). Output: `data/imports/swimcloud_YYYY-MM-DD_scrape.json` — envelope in `lib/validation/import-envelope.ts`. Rows include **`scorecardId`** when targets came from the DB (or optional field in file targets).

**URL:** `https://www.swimcloud.com/team/{teamId}/how-do-i-fit/` (logged-in session via Playwright `storageState`).

**Gender / season:** The fit page reflects the SwimCloud account’s athlete profile (gender, events, graduation year). The scraper does not override season; all numeric “fit” fields are whatever that page shows for the logged-in user.

| Output field | DOM / notes |
|--------------|-------------|
| `name` | From targets (DB or file). Import resolution prefers **`scorecardId`** then **`swimcloudTeamId`** then **name** — see `lib/import/find-school-for-import.ts`. |
| `scorecardId` | Optional on row — set from DB-backed targets or file; enables stable joins to `School.scorecardId`. |
| `hasSwimTeam` | Always `true` for successful fit scrape. |
| `swimcloudUrl` | `https://www.swimcloud.com/team/{id}/` |
| `scrapeTeamId`, `scrapePage` | Provenance (`how-do-i-fit`); stored via schema `passthrough` in `importSnapshotJson`. |
| `teamPowerIndexAvg` | Team average power index: `.c-power-index__markers--top .c-power-index__badge .c-title` (first marker — **team** strip, not swimmer). |
| `rosterSize` | `.c-team-size__total` |
| `seniorsGraduating` | `.c-team-size__legend-item` text matching `Senior (N)` |
| `matchScore` | `.js-match-score-total` attribute `data-score` |
| `abigailRank`, `athleteEvent` | Swim factor line: `.c-match-score__item:has(.fa-swimmer) .c-match-score__text` — ordinal + “in {event}”. |
| `eventDepthRankScope` | Set to `"team"` when `abigailRank` is present — depth is from the **Team Match** block (team-relative), not a conference-wide standings table. |
| `distanceMiles` | Any `.c-match-score__item .c-match-score__text` matching `(\d+) mi from` |
| `avgNetCost` | Same list: line with `$` and “average net cost” |
| `ncaaDivision` | Toolbar: `.c-toolbar__meta .o-list-inline--dotted > li > a` with `/division/` href preferred |
| `conference` | Toolbar: `a[href*='/conference/']` |
| `teamRankDisplay` | **Team Ranking** section (`section.rf-section` with that heading): Division 3 block `a.u-text-bold` + “/ N teams” from `.u-text-small` |

**Subscription:** Fit numerics assume an account that can load the full page (see `npm run swimcloud:smoke` and `.js-match-score-total` `data-paid` in `scripts/swimcloud/smoke.ts`). Review SwimCloud Terms before automating.

**Fragility:** Class names and layout can change. After fetches or selector edits, run `npm run swimcloud:validate` on a scrape file; use `SWIMCLOUD_VALIDATE_GOLDEN=1` for a quick golden spot-check (see `scripts/swimcloud/README.md`).

**Consortium teams:** Prefer one `School` + one `swimcloudTeamId` in the scorecard map for shared programs; see `docs/context/university_advisor_data_spec.md`.
