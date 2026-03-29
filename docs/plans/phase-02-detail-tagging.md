# Phase 2 — School detail, tagging, notes, coach contacts

**Depends on:** [Phase 1](phase-01-scaffold-list.md) (running app + seeded schools).  
**Unlocks:** Phase 3 (import surfaces on detail + list).

## Goal

Each school has a **single detail page** with sections for all domains; **manual** fields persist through the API with **Zod** validation. Coach recruiting is trackable immediately with **minimal CRUD**.

## Scope

1. **Route:** `/schools/[id]` — scrollable layout; sections: Identity, Tagging, Notes, Athletic, Academic, Financial, Research, Coach contacts (empty subsections OK until Phase 3+).
2. **Read:** `GET /api/schools/[id]` includes relations needed for the page (or minimal + lazy sections later — keep teachable).
3. **School updates:** `PATCH /api/schools/[id]` for editable `School` fields: tagging, notes, and identity fields that are manual per spec.
4. **Tagging:** lifecycle status; rejection reason only when `Rejected`; boolean flags. Validate allowed string values with Zod (no Prisma enums).
5. **Notes:** one textarea on `School`, read/write.
6. **Coach contacts (V1):** list + add/edit/delete on detail: `date`, `direction`, `type`, `summary` only. Do not expose `rawContent` / drafted-reply flows beyond schema placeholder.
7. **shadcn:** Input, Select, Textarea, Checkbox/Switch, Label, Card/Separator as needed; optional Dialog for contact edit.

## Stop & test

- [ ] From list, open any school detail; no 404 for valid `id`.
- [ ] Change lifecycle + a boolean flag; refresh page — values persist.
- [ ] Set lifecycle to Rejected with a reason; clear reason when moving away from Rejected (or show validation error per spec).
- [ ] Notes save and survive refresh.
- [ ] Add inbound + outbound coach rows with different types; edit one; delete one — all persist across refresh.
- [ ] Invalid PATCH payloads return **400** with readable Zod errors (not silent 500).

## References

- [university_advisor_data_spec.md](../context/university_advisor_data_spec.md) — validation rules, `CoachContact` shape

**Next:** [phase-03-import-athletics.md](phase-03-import-athletics.md)
