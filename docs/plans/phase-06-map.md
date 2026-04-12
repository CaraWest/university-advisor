# Phase 6 — Map (Leaflet)

**Depends on:** [Phase 3](phase-03-import-athletics.md) minimally (need lat/lng on schools — usually from research import); tagging from Phase 2 for filters.  
**Unlocks:** Phase 7 polish.

## Goal

**All schools with coordinates** appear on a **Leaflet** map; **distance from Round Rock** is visible; **tag/lifecycle filters** align with list behavior (teachable client component + dynamic import).

## Scope

1. **Dependencies:** Leaflet + React binding (e.g. `react-leaflet`) or minimal imperative Leaflet in `useEffect` — choose simpler for teaching.
2. **Route:** e.g. `/map` or tab from schools — pick one navigation pattern and document in README.
3. **Markers:** Popups with name + key tags; link to detail page.
4. **Filters:** Reuse filter concepts from list (e.g. text search); no tier-based hiding.
5. **shadcn:** Popover/Sheet for filter panel optional.
6. **Performance:** Acceptable for ~144 points; no clustering required in V1 unless needed on hardware.

## Stop & test

- [ ] Schools without lat/lng do not break the map (skipped or listed as “no coordinates”).
- [ ] After research import, new coords appear without code change.
- [ ] Filter reduces marker count consistently with expectations.
- [ ] Click marker navigates to `/schools/[id]`.
- [ ] Works on local Mac (tile provider attribution OK for personal use; document if API key needed).

## References

- [university_advisor_objectives_v2.md](../context/university_advisor_objectives_v2.md) — map feature

**Next:** [phase-07-polish.md](phase-07-polish.md)
