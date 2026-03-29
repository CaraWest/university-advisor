# Phase 5 — Settings + AI executive summary

**Depends on:** [Phase 4](phase-04-financial.md) (optional but realistic when research/swim exist).  
**Unlocks:** Phase 6 (map is independent; can run in parallel if staffed).

## Goal

**`/settings`** holds the global summary prompt. Per school, **generate** an objective executive summary once; **no auto-regeneration**; **Regenerate** is explicit. **Anthropic** model id comes from **environment variable** (verify current ID against docs at implementation time).

## Scope

1. **`/settings` page:** load/save `AppSettings.summaryPrompt` via API; shadcn form; explain what fields are included/excluded for co-builder clarity.
2. **Generate API:** `POST` (no streaming) builds prompt context:
   - **Include:** identity + geo from `School` (per latest product rules), all populated `SwimData`, `AcademicProfile`, `ResearchBlob` fields appropriate for narrative.
   - **Exclude:** ids, `createdAt`/`updatedAt`, `aiSummary`/`summaryGeneratedAt`, deadline fields, boolean flags, `lifecycleStatus`, `rejectionReason`, `notes`, all `FinancialModel`, all `CoachContact`, other user-authored content.
3. **Omit null/empty** from prompt payload.
4. **UX:** If `aiSummary` is set — disable primary Generate; show **Regenerate** only as deliberate action.
5. **Secrets:** `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL` (or equivalent) **server-only**; never expose to client bundles.

## Stop & test

- [ ] Save prompt on `/settings`; reload — text persists.
- [ ] Generate on a school with research+swim data — summary saved on `School`; page refresh shows same text.
- [ ] Second click on Generate does not run unless using Regenerate (verify network tab / server logs).
- [ ] Regenerate replaces summary and updates timestamp field per spec.
- [ ] Changing tags/notes/financials does **not** auto-trigger generation.
- [ ] API errors show a toast or inline message without leaking API key.

## References

- [university_advisor_data_spec.md](../context/university_advisor_data_spec.md) — `AppSettings`, AI context table
- [university_advisor_objectives_v2.md](../context/university_advisor_objectives_v2.md) — §8 AI design

**Next:** [phase-06-map.md](phase-06-map.md)
