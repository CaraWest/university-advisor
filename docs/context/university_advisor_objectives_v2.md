# University Advisor Project — Objectives Document
### Version 2 — Updated March 2026

**Project Owner:** Parent (legal tech / AI development background)
**Co-Builder:** Abigail — high school student, competitive swimmer
**Subject:** College search for Abigail, 1–2 years from enrollment

---

## 1. Project Purpose

This project has two equally important goals running in parallel:

1. **Practical:** Build a working research and decision-support application to guide Abigail's college search — a student-athlete with strong academics, an interest in international relations, and a tentative path toward law school.

2. **Educational:** Build the app together — parent and daughter as co-developers. Every feature Abigail helps build is something she understands, owns, and can explain. The project is as much about learning to build software as it is about finding the right school.

---

## 2. Student Profile

| Attribute | Detail |
|---|---|
| Name | Abigail |
| Academic standing | Strong GPA, advanced coursework |
| SAT score | 1270 (practice sitting); retake results pending |
| Athletic profile | Competitive swimmer — above average, sub-elite; has received unsolicited coach contact |
| SwimCloud Power Index | 42.11 |
| Division scope | DI, DII, DIII, and NAIA all in scope |
| Intended study area | International relations or adjacent program — as complement to a primary major, not the anchor |
| Law school intent | Tentative — primary degree must stand alone without law school |
| Primary major | Undiscovered — major exploration is part of the process |
| Study abroad | Strong interest; a meaningful factor in school selection |
| Geography | No constraints — best fit wins regardless of location |
| School size | No preference — culture and fit over size |
| Home base | Round Rock, TX |

---

## 3. Family Context

| Factor | Detail |
|---|---|
| Household income | ~$400k/year |
| Dependents | One child |
| Financial philosophy | Willing to invest in the right fit; cost modeled per school |
| Athletic scholarship | Nice to have, not a primary decision driver |
| Academic merit aid | Actively worth pursuing — DIII and NAIA schools especially |

> **Note on financials:** Per-school cost modeling is in scope. Retirement planning is a separate family exercise and is intentionally excluded from this project and from anything Abigail sees. Cost of attendance, merit aid estimates, and net cost are relevant. Retirement tradeoff modeling is not.

---

## 4. Athletic Fit Framework

Abigail has stated she wants to swim in college. Athletic fit is evaluated against her current Power Index of 42.11 with realistic improvement of 1–3% annually — she has been swimming year-round since age five and is 17.

**Athletic tier definitions:**

| Tier | Team Power Index Average | Recruiting expectation |
|---|---|---|
| Recruit target | 35–65 | Actively pursue coach contact |
| Walk-on possible | 21–34 | Swim may happen; don't lead with it |
| Below threshold | Under 20 | Removed from active list via Cowork filter |

The Power Index cutoff of 20 was used as the initial filter on the 109-school swim list. Schools below that threshold are removed — the gap is too large to close in the available timeline regardless of academic merit.

---

## 5. Academic Program Framework

IR is the anchor interest but the program label matters less than program depth. The following labels are treated as functionally equivalent for Abigail's purposes:

- **IR** — International Relations
- **IS** — International Studies
- **GS** — Global Studies
- **PPE** — Philosophy, Politics, and Economics
- **PE** — Political Economy
- **PS/IR** — Political Science with international concentration
- **PCS** — Peace and Conflict Studies
- **IE** — International Economics

Pre-law as a major or track is explicitly excluded. Law school preparation is evaluated through placement rates, LSAT outcomes, and pre-law advising quality — not through a pre-law program.

---

## 6. The Application — Feature Set

The project produces a working Next.js web application running locally. Abigail is a co-builder on this app.

### V1 Features

| Feature | Description |
|---|---|
| School master list | Full list of ~155 schools, table view, sortable and filterable |
| School detail page | Single scrollable page with all school data organized by section |
| Athletic fit tracking | Swim data, Power Index, tier tag, coach contact flags |
| Academic profile | Program label and type, study abroad depth, law school outcomes, pre-law quality |
| Financial modeling | Published COA, merit aid estimate, athletic aid, estimated net cost |
| AI executive summary | One global prompt template; generates once per school from objective data; saved to database |
| Tagging | Lifecycle status + rejection reason + boolean flags (see below) |
| Notes | Single freeform text field per school; read/write |
| Map | All schools plotted; passive visualization; filter by tags; distance from Round Rock, TX |
| Cowork JSON import | File-based ingestion of data collected by Cowork tasks |

### V2 Features (Planned, Not Scoped)

| Feature | Description |
|---|---|
| Card view toggle | Switch between table and card grid on the school list page |
| Gmail integration | Log outbound coach contact, capture inbound responses |
| Deadline management | Application deadlines per school, unified deadline view across active schools |

---

## 7. Tagging System

**Lifecycle status** — one per school, mutually exclusive:

| Status | Meaning |
|---|---|
| Research | On the list, not yet evaluated |
| Active | Being actively researched |
| Shortlisted | Serious contender |
| Applying | Application in progress |
| Rejected | Removed from consideration |

**Rejection reason** — applies only when status is Rejected:

| Reason | Meaning |
|---|---|
| Athletic mismatch | Power Index gap too large |
| Academic mismatch | Program too weak or too strong |
| Financial | Net cost doesn't work |
| Program fit | IR or adjacent program insufficient |
| No swim team | Athletic path doesn't exist |
| Abigail preference | She ruled it out |
| Parent preference | Parent ruled it out |

**Boolean flags** — independent of lifecycle status:

| Flag | Meaning |
|---|---|
| Abigail favorite | Expressed genuine interest |
| Coach contacted us | Unsolicited recruiting contact received |
| We contacted coach | Outbound contact initiated |
| Campus visit | Visit scheduled or completed |
| Apply early | EA or ED is the right strategy |

---

## 8. AI Executive Summary Design

One global prompt template is written by the parent and stored in the application. When triggered, the app injects the following into the prompt context:

**Included:**
- All populated structured school fields
- Cowork research blob (gathered once per school)

**Excluded:**
- Notes field
- Tags and lifecycle status
- Financial model estimates
- Coach contact log
- Any user-authored content

The summary is generated once and saved to the database. It is not regenerated automatically. Within a 12-month decision window, the underlying data is stable enough that a one-time generation is sufficient. A manual regenerate option exists but is not triggered by data changes.

This design ensures the summary is objective — it reflects the school, not the family's current thinking about the school.

---

## 9. Tech Stack

| Layer | Tool | Notes |
|---|---|---|
| Frontend | Next.js (App Router) | Single repo — no separate backend |
| Backend | Next.js API routes | Sufficient at this scale |
| Database | SQLite via Prisma | Local file; schema-first; teachable |
| Table component | TanStack Table | Lighter than AG Grid; better for teaching |
| AI summary | Anthropic API | claude-sonnet-4-5; called from API route |
| Map | TBD (Mapbox or Leaflet) | To be decided during map feature build |
| Data collection | Claude Cowork | Browser-based; outputs JSON for import |
| Email (V2) | Gmail connector via Cowork | Not in V1 |

---

## 10. Cowork's Role

Cowork is a **data collection tool**, not a decision engine. It is not the primary interface for the app — the Next.js app is.

Cowork tasks:
- Browse SwimCloud and extract Power Index, roster size, seniors graduating per school
- Browse school websites and research IR program depth, study abroad infrastructure, law school outcomes
- Output structured JSON files dropped into `/data/imports` for the app to ingest
- (V2) Read Gmail recruiting inbox and log coach communications

Cowork does not maintain the database, generate summaries, or drive application logic. It feeds data to the app.

---

## 11. Build Sequence

Each phase produces a working, usable thing — not a fragment.

| Phase | Deliverable |
|---|---|
| 1 | Prisma schema + seed data — database comes to life with real schools |
| 2 | School list page — table, all schools, sortable and filterable |
| 3 | School detail page — all fields, edit in place |
| 4 | Tagging system — lifecycle status, rejection reason, boolean flags |
| 5 | Athletic filter — Power Index range, division, tier tag display |
| 6 | Cowork import route — JSON file ingestion, field upsert |
| 7 | Financial model — per-school cost breakdown |
| 8 | AI executive summary — prompt template, API call, saved output |
| 9 | Map — schools plotted, tag filters, distance from Round Rock |
| 10 | Notes field — freeform text, read/write |

---

## 12. What This Project Is NOT

- Not a pre-law tracking system — pre-law as a major or track is explicitly excluded
- Not locked to any geographic region
- Not primarily an athletic scholarship hunt — swimming opens doors; it does not define the search
- Not a retirement planning tool — financial modeling is per-school cost only
- Not a finished application manager — Abigail is 1–2 years out; this is a research and decision tool
- Not a single-user parent tool — Abigail is a co-builder and primary user alongside her parent

---

## 13. Success Definition

This project is successful when:

- A shortlist of 8–12 schools exists, each with a complete profile covering athletic fit, academic quality, cost, and career pathway
- Abigail has enough information to form genuine opinions and preferences — and has helped build the tool that surfaced them
- The parent has a clear per-school financial picture
- The app is something Abigail can demo, explain, and be proud of
- Recruiting communications are organized and no deadlines have been missed

---

*This document supersedes Version 1 (March 2026). It should be updated as the student profile evolves, architectural decisions are refined, and V2 features are scoped.*
