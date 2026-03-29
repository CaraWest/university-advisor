# Phase 7 — Polish, teachability, backlog

**Depends on:** Phases 1–6 complete enough for real use.  
**Unlocks:** optional V2 features (out of scope unless promoted).

## Goal

The app feels **finished for V1**: clear empty states, loading, errors; README helps a new co-builder run and operate imports; known tech debt is listed, not buried.

## Scope

1. **UX:** shadcn **Skeleton** for list/detail; toasts for save/import/generate success/failure; friendly empty states (no swim data yet, no financials yet).
2. **README:** end-to-end setup, env vars, `data/imports/` workflow, how to run `POST /api/import` (curl or button).
3. **Consistency pass:** navigation (list / map / settings), page titles, focus order on forms.
4. **Backlog doc (optional):** V2 items — card view, Gmail, deadlines, automated seed regeneration script; law-spec or import contract version notes.

## Stop & test

- [ ] New user can follow README from zero to running app + seeded DB.
- [ ] Simulate slow network (throttle) — loading states appear, no duplicate submits.
- [ ] Import with mixed good/bad rows — user sees actionable summary (which schools updated, which skipped).
- [ ] No console errors on happy path navigation through list → detail → settings → map.

## References

- [university_advisor_objectives_v2.md](../context/university_advisor_objectives_v2.md) — success definition, V2 list

**Done:** V1 delivery checkpoint; promote items from objectives doc as family priorities.
