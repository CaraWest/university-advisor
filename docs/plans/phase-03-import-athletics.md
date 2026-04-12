# Phase 3 — Import pipeline, derived fields, athletic list UX

**Depends on:** [Phase 2](phase-02-detail-tagging.md) (detail page to verify imports).  
**Unlocks:** Phase 4 (financial UI polish) and realistic Phase 5 summaries.

## Goal

**Cowork JSON** in `data/imports/` updates the DB through **`POST /api/import`** (merged files per prefix). **Derived fields** live in one module. **List view** shows athletic tier for all schools (including **Below threshold**).

## Scope

1. **`lib/derived.ts`:** Haversine distance from Round Rock; `athleticTier` from team PI (≥35 Recruit target; 20–34 Walk-on; &lt;20 Below threshold — **no upper cap**); financial derivations reserved for Phase 4 if not yet in DB from import helpers.
2. **`data/imports/`:** `.gitkeep`; document naming: `swimcloud_*.json`, `research_*.json`, `financial_*.json`.
3. **`POST /api/import`:** No body filename — scan directory, pick **most recent** per pattern (by modified time or embedded date in name — pick one rule and document it). Parse with **Zod** per source type.
4. **Name resolution:** [lib/import/cowork-name-aliases.ts](../../lib/import/cowork-name-aliases.ts) aliases + case-insensitive DB lookup — **skip and log** unmatched names; **never** insert new schools from import. Matches any school in the database (seed or UI-added).
5. **Research import:** apply `institutionType` from JSON only when DB field is empty; if Cowork value conflicts with seed, **log and do not overwrite**.
6. **Upserts:** Update `SwimData`, `AcademicProfile`, `FinancialModel` (partial financial from import OK), `ResearchBlob`, and school geo/coords from research as per spec.
7. **List UI:** Swim tier column shows Recruit target / Walk-on possible; below-threshold is not labeled on the list (detail page still has full swim data).
8. **Detail UI:** Show swim metrics and tier; academic/research sections populate when import runs.

## Stop & test

- [ ] Drop sample `swimcloud_*.json` / `research_*.json` matching spec — run import — detail shows new swim/academic fields for matched schools.
- [ ] Introduce a name typo in JSON — row is skipped, server logs (or response summary lists) skipped names — **no new** `School` rows.
- [ ] Research JSON tries to change `institutionType` on a seeded school — DB value unchanged; conflict logged.
- [ ] Below-threshold school: appears in the list like others; no list badge or “Below threshold” label in the tier column.
- [ ] Re-run import with newer file — latest wins per your upsert rules (document behavior in handler comments).

## References

- [university_advisor_data_spec.md](../context/university_advisor_data_spec.md) — §3 import contract, §4 derived fields

**Next:** [phase-04-financial.md](phase-04-financial.md)
