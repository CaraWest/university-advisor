# Phase 1 — Scaffold + seeded school list (MVP)

**Depends on:** nothing (green‑field app shell in repo root).  
**Unlocks:** [phase-02-detail-tagging.md](phase-02-detail-tagging.md).

## Goal

Run the app locally and see **all 144 seeded schools** in a **sortable, filterable** table backed by **SQLite** (data from Prisma seed, not hard‑coded in the client).

## Out of scope for Phase 1

- School detail page beyond an optional **stub** (prefer list‑only if timeboxed).
- `PATCH` routes, Zod on writes, import, AI, map, financial edits.
- Below‑threshold filtering (Phase 3).

---

## Preconditions

- **Node:** LTS (e.g. 20.x) — note exact version in README when you add it.
- **Package manager:** npm or pnpm — pick one for the repo and stick to it in docs.
- **Existing files to preserve:** [prisma/seed-schools.ts](../../prisma/seed-schools.ts), [lib/import/cowork-name-aliases.ts](../../lib/import/cowork-name-aliases.ts). Do not remove; wire seed to `SEED_SCHOOLS`.

---

## Work order (do in this sequence)

### A. Next.js 14 + TypeScript + Tailwind

1. If there is **no** `package.json` in the repo root, scaffold from root:
   - Use **create‑next‑app** with **App Router**, **TypeScript**, **Tailwind**, **ESLint**.
   - **Pin Next to 14.x** in `package.json` (e.g. `"next": "14.2.x"`) — avoid Next 15 for teaching stability.
2. **Convention:** Either `app/` at repo root or `src/app/` — choose one; this plan assumes **`app/`** at root unless you already standardized on `src/`.
3. **Root layout:** `app/layout.tsx` — base metadata title (“University Advisor”), `globals.css`.

### B. shadcn/ui

1. Run shadcn **init** (`npx shadcn@latest init`): Tailwind + CSS variables, **New York** or **Default** style — pick one for the family and keep it.
2. **Phase 1 components** (add via CLI):
   - **button**, **table**
   - For TanStack “data table” pattern: **input**, **dropdown‑menu** (column visibility / filters), optionally **select** if you filter by enum‑like columns in the UI.
3. Document in README: “UI primitives come from shadcn under `components/ui/`.”

### C. Dependencies for the schools table

- `@tanstack/react-table` (v8)
- `@prisma/client` + `prisma` (dev)

No Zod required in Phase 1 for **GET** if you keep the API minimal; add Zod in Phase 2 for mutations.

### D. Prisma schema + SQLite

1. Ensure `prisma/schema.prisma` exists with:
   - `provider = "sqlite"`
   - `url = env("DATABASE_URL")`
2. **Models:** Implement all seven models exactly as in [university_advisor_data_spec.md](../context/university_advisor_data_spec.md) §2 (`School`, `SwimData`, `AcademicProfile`, `FinancialModel`, `CoachContact`, `ResearchBlob`, `AppSettings`):
   - All string “enum‑like” fields as **`String`** in Prisma (no native enums).
   - `CoachContact.rawContent` → `Json?`; `ResearchBlob.rawJson` → `Json?`.
   - Relations and `@unique` on one‑to‑one FKs as in the spec.
   - `School` V2 deadline fields present but unused in UI.
3. **`DATABASE_URL`:** align with spec — e.g. `file:./dev.db` relative to `prisma/` (or `prisma/dev.db` path your team prefers). Document the **actual** filename in `.env.example`.
4. **`.env`** / **`.env.example`:** only `DATABASE_URL` for Phase 1 (no Anthropic until Phase 5).
5. **`package.json` scripts:**
   - `db:generate` → `prisma generate`
   - `db:push` → `prisma db push` *or* `db:migrate` → `prisma migrate dev` (choose push for speed in teaching, or migrate if you want migration history from day one).
   - `db:seed` → `prisma db seed`
   - `db:studio` → `prisma studio` (optional, helpful for demos)
6. **Prisma seed:** set `"prisma": { "seed": "tsx prisma/seed.ts" }` or `ts-node` — use whatever matches your toolchain; `seed.ts` must:
   - Import `SEED_SCHOOLS` from [prisma/seed-schools.ts](../../prisma/seed-schools.ts).
   - **`createMany`** schools (or loop `create`) with `lifecycleStatus: "Research"`, all boolean flags `false`, `city` from seed row (may be null).
   - Ensure **exactly one** `AppSettings` row (`summaryPrompt: null` is fine).
   - Use **`$transaction`** or delete‑then‑seed only if you need repeatable runs — document behavior (e.g. “seed is for fresh DB” vs “idempotent upsert by name”).

### E. Prisma client singleton

- **`lib/db.ts`:** export a single `PrismaClient` instance; in development, attach to `globalThis` to avoid hot‑reload connection storms (standard Next + Prisma pattern).

### F. API: list schools

- **`app/api/schools/route.ts`** (or `src/app/...` if using `src/`):
  - **`GET`** only for Phase 1.
  - Use `prisma.school.findMany({ orderBy: { name: "asc" } })`.
  - Return JSON array of **list‑shaped** objects: at minimum `id`, `name`, `state`, `city`, `institutionType`, `lifecycleStatus` (optionally `updatedAt` for debugging).
  - **Do not** import Prisma in client components — browser talks only to this route.

### G. UI: home + schools list

1. **`app/page.tsx`:** `redirect("/schools")` or a minimal landing with a link to `/schools`.
2. **`app/schools/page.tsx`:**
   - **Fetch:** Either server component that calls Prisma directly *or* client page that `fetch("/api/schools")`. For **teaching** “API only” early, prefer **`fetch` to `GET /api/schools`** from a small client wrapper so Phase 2–3 patterns stay consistent.
3. **`components/schools/schools-data-table.tsx`** (client: `"use client"`):
   - TanStack Table + shadcn `Table`, `Button`, `Input`, `DropdownMenu`.
   - **Columns:** e.g. name, state, institution type, lifecycle (all seeds start `Research`).
   - **Sorting:** at least name + state (enable column sorting where it helps).
   - **Filtering:** at least one meaningful filter — e.g. **global text** on name or **column filter** on `state` / `institutionType`.
4. **Optional stub:** `app/schools/[id]/page.tsx` → “Detail coming in Phase 2” + link back — only if it does not slow Phase 1.

### H. README + `.gitignore`

- **README:** clone → install → copy `.env.example` → `db:push` → `db:seed` → `dev` → open `/schools` → expect **144** rows.
- **`.gitignore`:** ignore `prisma/dev.db`, `prisma/dev.db-journal` (or whatever SQLite files you create), `.env`.

---

## Stop & test

- [ ] Fresh install: `pnpm install` or `npm install` succeeds.
- [ ] `db:push` (or migrate) + `db:seed` completes without error.
- [ ] `npm run dev` → `/schools` shows **144** rows (match `SEED_SCHOOL_COUNT` in seed file).
- [ ] Sorting works on at least one column; filtering narrows rows visibly.
- [ ] Restart dev server: count still **144** (data in SQLite on disk).
- [ ] No Prisma or DB URLs in client bundle (quick check: list page only uses `fetch` or server‑only data path you documented).

---

## Quick reference — spec source of truth

| Topic | Document |
| ----- | -------- |
| Full Prisma shapes | [university_advisor_data_spec.md](../context/university_advisor_data_spec.md) §2 |
| Product context | [university_advisor_objectives_v2.md](../context/university_advisor_objectives_v2.md) |
| Seed rows | [prisma/seed-schools.ts](../../prisma/seed-schools.ts) |

---

## Risks / decisions to log for Abigail

- **Why API for read in Phase 1** (if you choose it): keeps one pattern — “browser never touches Prisma.”
- **`db push` vs migrate:** push is fewer files; migrate is better history — decide and write one sentence in README.
- **Seed idempotency:** re‑running seed should not create duplicate schools; either document “reset DB before seed” or upsert by `name`+`state`.

**Next:** [phase-02-detail-tagging.md](phase-02-detail-tagging.md)
