# University Advisor

Local Next.js app for college search and decision support. Phase 1: seeded school list from SQLite via Prisma.

## Requirements

- **Node.js** (LTS recommended) and **npm**

## Day-to-day

From the project folder:

```bash
npm run dev
```

That runs (automatically, before Next starts):

1. **`prisma db push`** — keeps the SQLite schema in sync  
2. **`prisma/dev-prep.ts`** — if there are **no** schools yet, seeds the DB (same data as `npm run db:seed`)

Then the dev server starts. Open [http://localhost:3000/schools](http://localhost:3000/schools). You should see **144** schools once seeded.

## First time on this machine

```bash
cp .env.example .env
npm install
```

(`npm install` runs **`prisma generate`** via `postinstall`.)

After that, use **`npm run dev`** only. The first `dev` will create `prisma/dev.db`, push the schema, and seed if the database is empty.

## Scripts

| Script | Purpose |
| ------ | ------- |
| `npm run dev` | `db push` + optional auto-seed if empty, then Next.js dev server |
| `npm run build` / `npm start` | Production build / serve (no `predev`; ensure DB exists first) |
| `npm run db:seed` | **Full reset:** wipe schools + related data + `AppSettings`, then reseed (use when you want a clean slate) |
| `npm run db:studio` | Prisma Studio |
| `npm run db:push` | Push schema only (usually not needed — `dev` does this) |

## Stack (Phase 1)

- Next.js **14** (App Router), TypeScript, Tailwind
- **shadcn/ui** under `components/ui/`
- **TanStack Table** v8 for the schools grid
- **Prisma** + **SQLite** (`DATABASE_URL` in `.env`, e.g. `file:./dev.db`)

## Docs

- Product/context: `docs/context/`
- Phase plans: `docs/plans/`
