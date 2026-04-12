# SwimCloud local tools

Private automation for importing fit-page data. Respect [SwimCloud Terms](https://www.swimcloud.com/terms); keep sessions local; do not commit `.local/`.

## Setup

```bash
npm install
```

Use **Google Chrome** with Playwright (`channel: "chrome"`) by default, or set `SWIMCLOUD_PLAYWRIGHT_CHANNEL=chromium` and run `npx playwright install chromium`.

## Save login session (once, or when cookies expire)

**If Cloudflare / Turnstile never finishes** (spinner, checkbox loop, or frozen check), skip the block below and use **[Real Chrome (recommended)](#real-chrome-when-cloudflare-wont-finish)** — Playwright-started Chrome is often still detected.

### Default (Playwright opens Chrome)

```bash
npm run swimcloud:auth
```

A browser opens — log in on SwimCloud, then press Enter in the terminal. Cookies are saved to `.local/swimcloud-storage.json` (or `SWIMCLOUD_STORAGE_STATE`).

### Real Chrome when Cloudflare won’t finish

Cloudflare may classify **any** Playwright-driven window as automated. Use **your** Chrome binary with debugging only (no Playwright launch):

**Terminal 1 — start Chrome and log in**

```bash
npm run swimcloud:chrome-debug
```

This opens SwimCloud in a dedicated profile under `.local/swimcloud-chrome-cdp`. Complete Cloudflare and sign in. Use a **normal** tab, not Incognito (cookies go to the default context Playwright reads).

**Terminal 2 — save cookies for smoke/fetch**

```bash
npm run swimcloud:auth:cdp
```

Press Enter when prompted. Same `storageState` path as `swimcloud:auth`.

Custom port: `SWIMCLOUD_CDP_PORT=9230 npm run swimcloud:chrome-debug` then `SWIMCLOUD_CDP_PORT=9230 npm run swimcloud:auth:cdp`.

Chrome not in the default install location? Set **`CHROME_PATH`** to the full path of the `chrome` / `Google Chrome` executable.

**Console messages (usually harmless)**

- **`favicon.ico` 404** — many sites don’t serve a favicon at that exact URL.
- **`xr-spatial-tracking` / CSP lines** — from Cloudflare’s challenge iframe, not your app.
- **Preload / 403 on `challenges.cloudflare.com`** — part of the challenge; the real problem is repeated reload of the checkbox, i.e. automation detection.

## Smoke test (session + paywalled page)

```bash
npm run swimcloud:smoke
```

Headless often **fails** even with a good `storageState` (the fit page never paints). If you see “Missing … Team Match”, run:

```bash
SWIMCLOUD_HEADED=1 npm run swimcloud:smoke
```

Optional: `SWIMCLOUD_SMOKE_WAIT_MS=60000` to wait longer for the SPA. Uses default URL Claremont McKenna–Mudd–Scripps fit page (`/team/261/how-do-i-fit/`). Override:

```bash
SWIMCLOUD_SMOKE_URL="https://www.swimcloud.com/team/419/how-do-i-fit/" npm run swimcloud:smoke
```

Exit code **0** if the page shows **Team Match** or **Team Strength** and you were not redirected to login.

## Scorecard ↔ SwimCloud map (recommended)

Curated **College Scorecard `scorecardId`** (UNITID) ↔ **SwimCloud team id** lives in **`data/swimcloud-scorecard-map.json`** (copy from `data/swimcloud-scorecard-map.example.json`). Validate entries against [College Scorecard](https://collegescorecard.ed.gov/) and SwimCloud `/team/{id}/`.

After **`School.scorecardId`** is populated (scorecard import):

```bash
npm run swimcloud:map:sync
```

That sets **`SwimData.swimcloudTeamId`** so swim imports can resolve schools by id (see `lib/import/find-school-for-import.ts`).

Imports can also persist team ids from **`swimcloudUrl`** / **`scrapeTeamId`**. To backfill ids from existing URLs and `importSnapshotJson` before a **full DB scrape**:

```bash
npm run swimcloud:backfill:team-ids
```

## Targets: file vs database

- **File:** Copy `targets.example.json` to **`data/swimcloud-targets.json`** (`SWIMCLOUD_TARGETS` for path). Rows: `{ "teamId", "name", "scorecardId"? }`.
- **Database:** If **`data/swimcloud-targets.json` does not exist**, `swimcloud:fetch` defaults to **DB targets** (same as `SWIMCLOUD_TARGETS_SOURCE=db` or **`npm run swimcloud:fetch:db`**). Schools need **`School.scorecardId`**, **`SwimData.swimcloudTeamId`**, and **`notInSwimCloud`** false — run **map sync** and/or **`npm run swimcloud:backfill:team-ids`** so every in-scope school with a known team gets a id.

**Full refresh (headed, local):** `npm run swimcloud:backfill:team-ids` → `npm run swimcloud:map:sync` (if you use the map) → `npm run swimcloud:fetch:headed` with DB targets → `npm run import:run`.

## Fetch (how-do-i-fit → import JSON)

After smoke passes, prefer a **headed** browser for real fit metrics — headless often parses an empty or incomplete shell (match score, power index, etc.).

**Recommended refresh:**

```bash
npm run swimcloud:fetch:headed
npm run import:run
```

Equivalent to `SWIMCLOUD_FETCH_HEADED=1 npm run swimcloud:fetch`. You can use **Import** in the app or `POST /api/import` instead of `import:run`.

**Headless (best-effort only):**

```bash
npm run swimcloud:fetch
```

Writes **`data/imports/swimcloud_YYYY-MM-DD_scrape.json`**.

**Other options:** `SWIMCLOUD_FETCH_DELAY_MS` (ms between teams, default 3000), `SWIMCLOUD_FETCH_PARSE_WAIT_MS` (max wait for fit UI after load, default 35000).

Validate a file:

```bash
npm run swimcloud:validate data/imports/swimcloud_2026-04-03_scrape.json
```

Golden spot-check (expects `scrapeTeamId` 261 and 419 in the file):

```bash
SWIMCLOUD_VALIDATE_GOLDEN=1 npm run swimcloud:validate path/to/swimcloud_*.json
```

Field semantics: `docs/context/swimcloud_scrape_spec.md`.
