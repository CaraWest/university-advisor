# Phase 4 — Financial model UI + manual fields

**Depends on:** [Phase 3](phase-03-import-athletics.md) (financial partial import may already land).  
**Unlocks:** Phase 5 (AI excludes financials — but family still needs UI to edit estimates).

## Goal

**FinancialModel** is visible and editable on the school detail page: published COA fields from import, **manual** merit/athletic/need judgments, and **derived** net cost + four-year estimate (recalculated consistently with spec).

## Scope

1. **Detail section:** COA breakdown (`publishedCOA`, tuition, room/board, fees); merit/athletic flags and thresholds from import where present; manual numeric fields per spec (`estimatedMeritAid`, `estimatedAthleticAid`, `needAidLikely`, `financialNotes`).
2. **Derived display:** `estimatedNetCost`, `fourYearEstimate` — compute in `lib/derived.ts` (or on save server-side) so UI and future imports agree.
3. **API:** Extend `PATCH /api/schools/[id]` to upsert/patch nested `FinancialModel` or dedicated `PATCH /api/schools/[id]/financial` — pick one pattern and stay consistent.
4. **Zod:** Validate non-negative net cost per spec; athletic aid availability rules vs division if duplicated from import logic.
5. **shadcn:** format currency readably; use Cards/Separators for scanability.

## Stop & test

- [ ] School with only imported COA shows numbers; manual fields start empty or sensible defaults.
- [ ] Editing merit/athletic estimates updates derived net + four-year immediately or after save (consistent UX).
- [ ] Invalid values (e.g. negative net if disallowed) rejected with Zod error.
- [ ] Refresh retains financial data; relation is 1:1 with school.

## References

- [university_advisor_data_spec.md](../context/university_advisor_data_spec.md) — `FinancialModel`, derived rules

**Next:** [phase-05-ai-settings.md](phase-05-ai-settings.md)
