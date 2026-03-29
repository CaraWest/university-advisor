# University Advisor — implementation plans

**Cursor plan index (repo copy):** [00-cursor-index.md](00-cursor-index.md) — mirrors the “University Advisor Phases” Cursor todo list and quick file paths.

Each phase is a **separate plan file** with a **Stop & test** section so you can pause, verify behavior, and demo progress before starting the next phase.

**Specs (always in scope):** [docs/context/university_advisor_data_spec.md](../context/university_advisor_data_spec.md), [docs/context/university_advisor_objectives_v2.md](../context/university_advisor_objectives_v2.md).

| Phase | Plan | Delivers |
|-------|------|----------|
| 1 | [phase-01-scaffold-list.md](phase-01-scaffold-list.md) | Next.js 14, shadcn, Prisma + seed, schools **list** from DB |
| 2 | [phase-02-detail-tagging.md](phase-02-detail-tagging.md) | Detail page, tagging, notes, coach contacts (minimal CRUD) |
| 3 | [phase-03-import-athletics.md](phase-03-import-athletics.md) | Cowork import route, derived fields, athletic list UX + below-threshold toggle |
| 4 | [phase-04-financial.md](phase-04-financial.md) | Financial section on detail, manual + derived cost UI |
| 5 | [phase-05-ai-settings.md](phase-05-ai-settings.md) | `/settings` prompt, generate/regenerate summary (Anthropic, env model) |
| 6 | [phase-06-map.md](phase-06-map.md) | Leaflet map, markers, filters |
| 7 | [phase-07-polish.md](phase-07-polish.md) | Loading/empty/error UX, README, optional backlog |

**Stack (all phases):** Next.js 14 (App Router), TypeScript, Tailwind, **shadcn/ui**, TanStack Table v8, Prisma + SQLite, Zod on API boundaries, no Prisma enums, no auth.

**Existing repo assets:** [prisma/seed-schools.ts](../../prisma/seed-schools.ts), [lib/import/cowork-name-aliases.ts](../../lib/import/cowork-name-aliases.ts).
