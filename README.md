# University Advisor

Local Next.js app for college search and decision support: seeded schools, SwimCloud / Scorecard imports, financial estimates, AI summaries, and a map.

## Requirements

- **Node.js** (LTS recommended) and **npm**

## From zero to running

1. Clone the repo and `cd` into the project folder.

2. Install dependencies:

   ```bash
   npm install
   ```

   (`npm install` runs **`prisma generate`** via `postinstall`.)

3. Environment file:
   - If **`.env`** does not exist, **`npm run dev`** copies **`.env.example`** to **`.env`** (see `scripts/ensure-env.mjs`).
   - To set variables before the first run: `cp .env.example .env` and edit.

4. Start the app:

   ```bash
   npm run dev
   ```

   That runs (before Next.js starts):

   - **`prisma db push`** — PostgreSQL schema (uses `DIRECT_URL` from `.env` when set; see Prisma + Supabase)
   - **`prisma/dev-prep.ts`** — if there are **no** schools yet, seeds the DB (same as `npm run db:seed`)

5. Open **[http://localhost:3000](http://localhost:3000)** — you are sent to **`/login`**, then **Continue with Google**. Only emails listed in **`ALLOWED_EMAILS`** can sign in (in development, leaving it empty allows any Google account for easier local testing; in production, empty means no one can sign in). After login you land on `/schools` (or your `callbackUrl`).

### Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | Yes (default in `.env.example`) | PostgreSQL connection string; with Supabase, use the **pooler** URI (often port `6543`) and add `?pgbouncer=true&connection_limit=1` as in [Prisma’s Supabase guide](https://www.prisma.io/docs/guides/database/supabase) |
| `DIRECT_URL` | Yes (in `.env.example`) | Same database over the **direct** Postgres port (often `5432`) for `prisma db push` / migrations — copy from Supabase **Database** settings |
| `SCORECARD_API_KEY` | For `npm run scorecard:import` | [College Scorecard API](https://api.data.gov/signup/) |
| `ANTHROPIC_API_KEY` | For AI summaries only | [Anthropic Console](https://console.anthropic.com/) |
| `ANTHROPIC_MODEL` | No | Override Claude model id (see [docs/ai-summary-setup.md](docs/ai-summary-setup.md)) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Yes for sign-in + Mail | [Google Cloud Console](https://console.cloud.google.com/) OAuth client |
| `NEXTAUTH_SECRET` | Yes | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Yes | App origin, e.g. `http://localhost:3000` locally; **exact** production URL on Vercel (no trailing slash) |
| `ALLOWED_EMAILS` | Yes in production | Comma-separated Google account emails allowed to use the app (case-insensitive). Empty in **production** = no sign-ins. Empty in **development** = any Google account. |

Restart **`npm run dev`** after changing `.env`.

**Vercel / production:** Set the same variables in the project dashboard. In Google Cloud, add your production **Authorized JavaScript origins** and redirect URI **`https://<your-domain>/api/auth/callback/google`**. Crawlers are discouraged via **`/robots.txt`** (`Disallow: /`).

**First-time database:** With valid `DATABASE_URL` and `DIRECT_URL`, run **`npx prisma db push`** to apply [`prisma/schema.prisma`](prisma/schema.prisma) to your Postgres instance (also runs automatically in `npm run dev` via `predev`).

### Main routes (navigation bar on each page)

| Path | Purpose |
|------|---------|
| `/login` | Google sign-in (not shown in sidebar) |
| `/schools` | Sortable table, lifecycle, filters |
| `/schools/[id]` | Full school profile, notes, financials, AI summary, coach log |
| `/map` | Leaflet map (needs lat/lng — usually Scorecard import) |
| `/import` | Run **`POST /api/import`** from the browser; summary of processed / skipped rows |
| `/settings` | Global AI prompt template (`AppSettings`) |

## `data/imports/` workflow

Batch JSON (Scorecard script, local **SwimCloud** fetch, or manual exports) goes under **`data/imports/`**. Filename prefixes determine the pipeline stage. Full rules: **[data/imports/README.md](data/imports/README.md)**. SwimCloud: **`npm run swimcloud:auth`** then **`npm run swimcloud:fetch`** (see **`scripts/swimcloud/README.md`**).

**Apply imports** (merges all matching files per source, oldest first by file `mtime`):

- **UI:** open **[http://localhost:3000/import](http://localhost:3000/import)** and click **Run import**.
- **CLI:** `npm run import:run` (uses local `DATABASE_URL`), or with the dev server up:

  ```bash
  curl -X POST http://localhost:3000/api/import
  ```

  (That `curl` only works if you pass a valid session cookie; the UI is the usual path.)

The JSON response lists each source (`school_research`, `financial`, `swimcloud`, `scorecard`): files used, rows processed, rows skipped (e.g. unknown school name), and parse errors per file when applicable.

## Day-to-day

```bash
npm run dev
```

## Scripts

| Script | Purpose |
| ------ | ------- |
| `npm run dev` | `db push` + optional auto-seed if empty, then Next.js |
| `npm run build` / `npm start` | Production build / serve (`predev` does **not** run; ensure DB exists) |
| `npm run db:seed` | **Full reset:** wipe schools + related data + `AppSettings`, then reseed |
| `npm run db:studio` | Prisma Studio |
| `npm run db:push` | Push schema only |
| `npm run db:restore-from-sqlite` | **Destructive:** replace Postgres data from local `prisma/dev.db` (set `SQLITE_PATH` for another file) |
| `npm run scorecard:import` | Build/normalize Scorecard JSON (needs `SCORECARD_API_KEY`) |

## Stack

- Next.js **14** (App Router), TypeScript, Tailwind, **shadcn/ui**, **TanStack Table** v8
- **Prisma** + **PostgreSQL** (e.g. [Supabase](https://supabase.com/))
- **Leaflet** + **react-leaflet** (map)
- **Sonner** (toasts)
- **Anthropic** SDK (optional, for summaries)

## Docs

- Product/context: `docs/context/`
- Phase plans: `docs/plans/`
- AI summaries (API key, models, prompt): [docs/ai-summary-setup.md](docs/ai-summary-setup.md)
- V2 ideas (not scheduled): [docs/backlog-v2.md](docs/backlog-v2.md)

## Map tiles

The map uses **OpenStreetMap** raster tiles (attribution shown on the map). No Mapbox key required for local/personal use.
