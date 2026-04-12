# Batch import files

Place JSON exports here. `POST /api/import` (or `npm run import:run` with the dev database) loads **every** `*.json` file for each prefix and **merges** them in `mtime` order (oldest first). You can split a source into batches (e.g. 15 schools per file). If the same school appears in more than one file, **later** files (newer `mtime`) win on upsert.

| Prefix        | `source` in JSON | Example filename |
|---------------|------------------|-------------------|
| `swimcloud_`  | `"swimcloud"`    | `swimcloud_2026-04-03_scrape.json` |
| `research_`   | `"school_research"` | `research_2026-03-29.json` |
| `financial_`  | `"financial"`    | `financial_2026-03-29.json` |
| `scorecard_`  | `"scorecard"`   | `scorecard_2026-03-29.json` |

**SwimCloud:** Generate fresh fit data locally; prefer **`npm run swimcloud:fetch:headed`** for reliable metrics (see `scripts/swimcloud/README.md` and `docs/context/swimcloud_scrape_spec.md`). Files must include top-level **`"source": "swimcloud"`** and **`"collectedAt"`** (ISO string); optional **`stats`** is allowed.

**Resolving schools on swim import:** Rows are matched in this order: optional **`scorecardId`**, then **`swimcloudTeamId`** / **`scrapeTeamId`** against `SwimData.swimcloudTeamId` (populate via **`npm run swimcloud:map:sync`** from [`data/swimcloud-scorecard-map.json`](../swimcloud-scorecard-map.example.json)), then **`name`** + aliases. Skips usually mean **no `School` row**, **no `scorecardId` on school**, or **no map/sync** yet — not “no swim team” on SwimCloud.

**Consortium rule:** One SwimCloud team id is typically attached to **one** representative `School` row in the map (e.g. CMS); do not duplicate the same `swimcloudTeamId` across multiple schools unless intentional.

**Triage swim import skips:** Decide why a row failed — **Path A:** batch is larger than your seeded scope; skipping is expected. **Path B:** school should be in-app → add to `docs/context/IR_LawPrep_Schools_v2.md` and `prisma/seed-schools.ts`, then re-import. **Path C:** school already exists with `School.scorecardId` but names differ → curate [`data/swimcloud-scorecard-map.json`](../swimcloud-scorecard-map.example.json), run `npm run swimcloud:map:sync`, and use scrape rows with `scorecardId` (file targets or DB-backed fetch) so resolution does not depend on string `name`. Alias map (`lib/import/cowork-name-aliases.ts`) only helps the **name** fallback when a row matches a school that is already in the database.

The filename prefix must match the kind of data in the file. **College Scorecard** uses `scorecard_` + `"source": "scorecard"`.

Each file must be valid JSON matching the envelope in `lib/validation/import-envelope.ts` (`source`, `collectedAt`, `schools`). The JSON response lists `paths` and `filesMerged` per source; per-file parse errors appear in `fileErrors` when some files were skipped but others applied.

Sample JSON files are gitignored under `data/imports/*.json` so local drops are not committed.

**Scorecard shape:** Prefer the same field order and rounding as `scripts/scorecard-import.ts` (`name`, `state`, `dataCollectedAt`, then optional fields). To normalize existing exports: `npx tsx scripts/normalize-scorecard-batch.ts [path] [count]` (default: first 15 rows).

Avoid keeping **both** a monolithic `scorecard_…json` and separate batch files that repeat the same schools — the API merges every matching file, so duplicates are redundant (results should still match).
