# University Advisor — Data Specification
### Version 1.0 — March 2026

**Purpose:** Authoritative reference for the application database schema, field definitions, data sources, and Cowork import contract. All Cursor development and Cowork task design should reference this document.

---

## 1. Database Overview

**Engine:** SQLite via Prisma ORM  
**Location:** Local file — `/prisma/dev.db`  
**Schema file:** `/prisma/schema.prisma`  
**Access pattern:** Next.js API routes only — no direct client-side database access

**Models:**
- `School` — master record for each institution
- `SwimData` — athletic data per school (one-to-one)
- `AcademicProfile` — IR/adjacent program data per school (one-to-one)
- `FinancialModel` — per-school cost modeling (one-to-one)
- `CoachContact` — recruiting contact log per school (one-to-many)
- `ResearchBlob` — Cowork-gathered unstructured research per school (one-to-one)
- `AppSettings` — global application settings including AI prompt template (singleton)

---

## 2. Model Definitions

---

### 2.1 School

The master record. Every other model relates to this one.

```prisma
model School {
  id                String    @id @default(cuid())

  // Identity
  name              String
  state             String
  city              String?
  institutionType   String    // "Research-HighSelectivity" | "Research-IRFocus" |
                              // "Research-LargePublic" | "LAC-HighlySelective" |
                              // "LAC-IRFocus" | "WomensCollege"
  latitude          Float?    // For map feature
  longitude         Float?    // For map feature
  distanceFromHome  Float?    // Miles from Round Rock, TX — derived on import

  // Tagging — lifecycle
  lifecycleStatus   String    @default("Research")
                              // "Research" | "Active" | "Shortlisted" |
                              // "Applying" | "Rejected"
  rejectionReason   String?   // Populated only when lifecycleStatus = "Rejected"
                              // "Athletic mismatch" | "Academic mismatch" |
                              // "Financial" | "Program fit" | "No swim team" |
                              // "Abigail preference" | "Parent preference"

  // Tagging — boolean flags
  abigailFavorite   Boolean   @default(false)
  coachContactedUs  Boolean   @default(false)
  weContactedCoach  Boolean   @default(false)
  campusVisit       Boolean   @default(false)
  applyEarly        Boolean   @default(false)

  // Notes
  notes             String?   // Freeform; read/write; not used in AI summary

  // AI Executive Summary
  aiSummary         String?   // Generated once; saved permanently
  summaryGeneratedAt DateTime? // Timestamp of last generation

  // V2 deadline fields — stored but not surfaced in V1 UI
  appDeadlineEA     DateTime?
  appDeadlineED     DateTime?
  appDeadlineRD     DateTime?

  // Relations
  swimData          SwimData?
  academicProfile   AcademicProfile?
  financialModel    FinancialModel?
  coachContacts     CoachContact[]
  researchBlob      ResearchBlob?

  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
}
```

**Field source map:**

| Field | Source | Method |
|---|---|---|
| name | Seed data | Manual |
| state | Seed data | Manual |
| city | Seed data | Manual |
| institutionType | Seed data | Manual |
| latitude | Cowork / geocoding | Import |
| longitude | Cowork / geocoding | Import |
| distanceFromHome | Derived | Calculated on import from lat/lng |
| lifecycleStatus | App UI | Manual — parent or Abigail |
| rejectionReason | App UI | Manual — parent or Abigail |
| Boolean flags | App UI | Manual — parent or Abigail |
| notes | App UI | Manual — freeform |
| aiSummary | Anthropic API | Generated in app |
| summaryGeneratedAt | App | Set on generation |
| appDeadline* | V2 | Deferred |

---

### 2.2 SwimData

Athletic profile data per school. One-to-one with School.

```prisma
model SwimData {
  id                String  @id @default(cuid())
  school            School  @relation(fields: [schoolId], references: [id])
  schoolId          String  @unique

  // Division and program
  ncaaDivision      String?   // "DI" | "DII" | "DIII" | "NAIA" | "None"
  hasSwimTeam       Boolean   @default(true)
  athleticTier      String?   // "Recruit target" | "Walk-on possible" |
                              // "Below threshold" — derived from teamPowerIndex

  // Power Index
  teamPowerIndexAvg Float?    // SwimCloud team average
  abigailRank       Int?      // Her projected rank on this roster

  // Roster
  rosterSize        Int?
  seniorsGraduating Int?      // Current year graduating seniors

  // SwimCloud “how do I fit” / page scrape (see also importSnapshotJson)
  matchScore          Int?
  teamRankDisplay     String?
  conference          String?
  athleteEvent        String?
  distanceMiles       Int?
  schoolSize          String?
  pageCity            String?
  pageState           String?
  pageSetting         String?
  swimcloudAvgNetCost Int?
  importSnapshotJson  String? // full row JSON including unknown keys

  // Source metadata
  swimcloudUrl      String?   // Source page URL for verification
  dataCollectedAt   DateTime? // When Cowork pulled this data

  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
}
```

**Field source map:**

| Field | Source | Method |
|---|---|---|
| ncaaDivision | SwimCloud | Cowork import |
| hasSwimTeam | SwimCloud | Cowork import |
| athleticTier | Derived | Calculated on import from teamPowerIndexAvg |
| teamPowerIndexAvg | SwimCloud | Cowork import |
| abigailRank | SwimCloud | Cowork import |
| rosterSize | SwimCloud | Cowork import |
| seniorsGraduating | SwimCloud | Cowork import |
| swimcloudUrl | SwimCloud | File import |
| swimcloudTeamId | Curated map (`npm run swimcloud:map:sync`) or swim scrape `scrapeTeamId` | Stable link to SwimCloud team |
| dataCollectedAt | Cowork | Set on import |

**Consortium programs:** One SwimCloud team id should map to **one** representative `School` row (e.g. a joint program listed under a single college’s `scorecardId`). Duplicating the same `swimcloudTeamId` across multiple schools is discouraged unless deliberate.

**Canonical naming (follow-up):** A future option is `School.scorecardInstitutionName` filled from Scorecard apply and used before `name` for string-only import resolution, avoiding mass renames of `School.name`.
| matchScore, teamRankDisplay, conference, athleteEvent, distanceMiles, schoolSize, pageCity, pageState, pageSetting, swimcloudAvgNetCost | SwimCloud page | Cowork import |
| importSnapshotJson | SwimCloud | Full parsed school row JSON |

**Athletic tier derivation logic:**

```
teamPowerIndexAvg >= 35  →  "Recruit target"
teamPowerIndexAvg 20–34  →  "Walk-on possible"
teamPowerIndexAvg < 20   →  "Below threshold"
```

---

### 2.3 AcademicProfile

IR and adjacent program data per school. One-to-one with School.

```prisma
model AcademicProfile {
  id                  String  @id @default(cuid())
  school              School  @relation(fields: [schoolId], references: [id])
  schoolId            String  @unique

  // Program
  programLabel        String?   // "IR" | "IS" | "GS" | "PPE" | "PE" |
                                // "PS/IR" | "PCS" | "IE"
  programType         String?   // "Standalone major" | "Concentration" | "Minor only"
  flagshipSchool      String?   // Named school or dept, e.g. "Elliott School", "Korbel"
  programNotes        String?   // Qualitative description of program depth

  // Study abroad
  studyAbroadLevel    String?   // "Core requirement" | "Strong culture" | "Available"
  studyAbroadNotes    String?   // Specific programs, partner institutions, participation rate

  // Academics
  acceptanceRate      Float?    // Overall institutional acceptance rate (percentage)
  satMid50Low         Int?      // SAT composite mid-50% lower bound (math + EBRW)
  satMid50High        Int?      // SAT composite mid-50% upper bound (math + EBRW)
  satMathMid50Low     Int?      // SAT Math section mid-50% lower bound (200-800)
  satMathMid50High    Int?      // SAT Math section mid-50% upper bound (200-800)
  satEBRWMid50Low     Int?      // SAT Evidence-Based Reading & Writing mid-50% lower bound (200-800)
  satEBRWMid50High    Int?      // SAT Evidence-Based Reading & Writing mid-50% upper bound (200-800)
  enrollmentSize      Int?      // Total undergraduate enrollment
  setting             String?   // "Urban" | "Suburban" | "Rural" | "College town"
  retentionRate       Float?    // First-year retention rate (percentage)
  gradRate4Year       Float?    // Four-year graduation rate (percentage)
  studentFacultyRatio Float?    // e.g. 10 for 10:1

  // Law school outcomes
  t14Placements       String?   // Qualitative or count of T14 placements
  preLawQuality       String?   // "Strong" | "Adequate" | "Checkbox"
  feederReputation    String?   // Qualitative note on law school admissions recognition

  // Source metadata
  dataCollectedAt     DateTime?

  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt
}
```

**Field source map:**

| Field | Source | Method |
|---|---|---|
| programLabel | Cowork / seed | Cowork import or manual |
| programType | Cowork | Cowork import |
| flagshipSchool | Cowork | Cowork import |
| programNotes | Cowork | Cowork import |
| studyAbroadLevel | Cowork | Cowork import |
| studyAbroadNotes | Cowork | Cowork import |
| acceptanceRate | Common Data Set / US News | Cowork import |
| satMid50Low/High | Common Data Set / US News | Cowork import |
| enrollmentSize | US News / school | Cowork import |
| setting | School website | Cowork import |
| retentionRate | US News | Cowork import |
| gradRate4Year | US News | Cowork import |
| studentFacultyRatio | US News | Cowork import |
| t14Placements | School reported / LinkedIn | Cowork import |
| preLawQuality | Cowork research | Cowork import |
| feederReputation | Cowork research | Cowork import |

---

### 2.4 FinancialModel

Per-school cost modeling. One-to-one with School. Does not include retirement modeling.

```prisma
model FinancialModel {
  id                    String  @id @default(cuid())
  school                School  @relation(fields: [schoolId], references: [id])
  schoolId              String  @unique

  // Published costs
  publishedCOA          Int?    // Total published cost of attendance (annual)
  tuition               Int?    // Tuition only
  roomAndBoard          Int?    // Room and board
  feesAndOther          Int?    // Fees, books, personal

  // Aid estimates
  estimatedMeritAid     Int?      // Annual estimate based on her profile
  athleticAidAvailable  Boolean?  // DI/DII only — DIII/NAIA cannot offer athletic aid
  estimatedAthleticAid  Int?      // Annual estimate if applicable
  needAidLikely         Boolean?  // Likely to receive need-based aid at ~$400k income

  // Derived
  estimatedNetCost      Int?      // publishedCOA minus all estimated aid (annual)
  fourYearEstimate      Int?      // estimatedNetCost x 4

  // Notes
  financialNotes        String?   // Assumptions, caveats, scenarios

  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
}
```

**Field source map:**

| Field | Source | Method |
|---|---|---|
| publishedCOA | School financial aid page | Cowork import |
| averageAnnualCost | College Scorecard | Scorecard import / enrich (`latest.cost.avg_net_price.overall`). Distinct from `avgNetCostHighIncome` (net price for $110k+ income cohort only). |
| tuition | School financial aid page | Cowork import |
| roomAndBoard | School financial aid page | Cowork import |
| feesAndOther | School financial aid page | Cowork import |
| estimatedMeritAid | Parent judgment | Manual in app |
| athleticAidAvailable | Division rules | Derived from `SwimData.ncaaDivision` (normalize SwimCloud labels such as `Division 1` / `Division 2` / `Division 3` to DI/DII/DIII; same aid rules as `DI`/`DII`/`DIII`/`NAIA`) |
| estimatedAthleticAid | Parent judgment | Manual in app |
| needAidLikely | Parent judgment | Manual in app (likely false at $400k) |
| estimatedNetCost | Derived | Calculated in app |
| fourYearEstimate | Derived | Calculated in app |
| financialNotes | App UI | Manual |

---

### 2.5 CoachContact

Recruiting contact log. One-to-many with School. V1 is manual entry — V2 populates via Gmail connector.

```prisma
model CoachContact {
  id            String    @id @default(cuid())
  school        School    @relation(fields: [schoolId], references: [id])
  schoolId      String

  date          DateTime
  direction     String    // "Inbound" | "Outbound"
  type          String    // "Email" | "Call" | "Camp" | "Visit" | "Other"
  summary       String    // Brief description of the contact
  rawContent    Json?     // Full email or notes content — V2 Gmail import
  draftedReply  Boolean   @default(false)

  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}
```

---

### 2.6 ResearchBlob

Unstructured research gathered by Cowork per school. Stored as JSON. Used as context in AI summary generation alongside structured fields. One-to-one with School.

```prisma
model ResearchBlob {
  id              String    @id @default(cuid())
  school          School    @relation(fields: [schoolId], references: [id])
  schoolId        String    @unique

  programDepth    String?   // IR/adjacent program detail — faculty, centers, curriculum
  studyAbroad     String?   // Specific programs, participation rates, partner institutions
  lawSchoolDetail String?   // Placement detail, LSAT prep, advising quality narrative
  swimDetail      String?   // Coach tenure, team culture, recent performance
  notableFacts    String?   // Anything distinctive that doesn't fit structured fields

  rawJson         Json?     // Full Cowork output preserved for reference
  collectedAt     DateTime?

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}
```

---

### 2.7 AppSettings

Singleton table. One row only. Stores global application configuration including the AI prompt template.

```prisma
model AppSettings {
  id              String    @id @default(cuid())
  summaryPrompt   String?   // Parent-authored global prompt template for AI summary
  promptUpdatedAt DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}
```

**Operator setup:** where to put the Anthropic API key, how to choose a model, and how the prompt is saved (DB + `/settings`) is documented in [**docs/ai-summary-setup.md**](../ai-summary-setup.md).

**AI summary prompt context rules:**

The following are injected into the prompt at generation time:

| Included | Excluded |
|---|---|
| All populated School fields | notes field |
| All populated SwimData fields | lifecycleStatus |
| All populated AcademicProfile fields | rejectionReason |
| All populated ResearchBlob fields | Boolean flags |
| School lat/lng and distance from home | financialModel fields |
| | coachContacts |
| | Any user-authored content |

Null and empty fields are omitted from the prompt context — only populated fields are injected.

---

## 3. Batch import contract (JSON envelopes)

JSON files under `data/imports/` are validated with **`lib/validation/import-envelope.ts`** and merged by prefix. Sources include local **SwimCloud fetch** (`npm run swimcloud:fetch`), **College Scorecard** export, and manual research/financial batches. The app exposes **`POST /api/import`** and **`npm run import:run`**; schools are matched by name and fields are upserted. Files are retained after import for audit.

**One file per data source. Four source types in V1:**

---

### 3.1 SwimCloud Import

**File naming:** `swimcloud_YYYY-MM-DD.json` (batches may use suffixes, e.g. `swimcloud_2026-03-29_batch1.json`).

Optional top-level **`stats`** object (batch metadata) is ignored by persistence but allowed by validation.

Each school row may include **any extra keys**; they are preserved in `SwimData.importSnapshotJson` as JSON. Known keys are mapped to `SwimData` columns (team PI, roster, match metadata, page city/state/setting, `swimcloudAvgNetCost`, etc.).

**Overlap with College Scorecard (academic + net cost):** SwimCloud may carry `acceptanceRate`, SAT mid-50, `enrollmentSize`, `setting`, `retentionRate`, `gradRate4Year`, and `avgNetCost`. On import, those values are written to **`AcademicProfile`** / **`FinancialModel.estimatedNetCost`** only when the corresponding database field is still **null** — a later or earlier **scorecard** import **supersedes** those slots when it supplies a value. SwimCloud’s own copy of page metrics remains on **`SwimData`** (`pageCity`, `pageState`, `pageSetting`, `swimcloudAvgNetCost`, full **`importSnapshotJson`**), so **no source data is discarded**.

```json
{
  "source": "swimcloud",
  "collectedAt": "2026-03-29T10:00:00Z",
  "stats": { "batchNumber": 1, "batchOf": 139 },
  "schools": [
    {
      "name": "Davidson College",
      "ncaaDivision": "DIII",
      "hasSwimTeam": true,
      "teamPowerIndexAvg": 44.2,
      "abigailRank": 6,
      "rosterSize": 18,
      "seniorsGraduating": 3,
      "swimcloudUrl": "https://www.swimcloud.com/team/123/"
    }
  ]
}
```

---

### 3.2 School Research Import

**File naming:** `research_YYYY-MM-DD.json`

```json
{
  "source": "school_research",
  "collectedAt": "2026-03-29T10:00:00Z",
  "schools": [
    {
      "name": "Davidson College",
      "latitude": 35.4996,
      "longitude": -80.8490,
      "institutionType": "LAC-HighlySelective",
      "programLabel": "IR",
      "programType": "Standalone major",
      "flagshipSchool": null,
      "programNotes": "Strong political science department; IR major well-regarded for law school prep",
      "studyAbroadLevel": "Strong culture",
      "studyAbroadNotes": "Dean Rusk International Studies Program; ~60% of students study abroad",
      "acceptanceRate": 19.2,
      "satMid50Low": 1340,
      "satMid50High": 1500,
      "enrollmentSize": 1950,
      "setting": "College town",
      "retentionRate": 95.0,
      "gradRate4Year": 91.0,
      "studentFacultyRatio": 10,
      "t14Placements": "Consistent T14 placements; Harvard, Virginia, Duke noted",
      "preLawQuality": "Strong",
      "feederReputation": "Well-regarded in law school admissions offices regionally and nationally",
      "researchBlob": {
        "programDepth": "IR major draws from political science, history, and economics. No separate school but faculty include former State Dept and NGO practitioners. Senior thesis required.",
        "studyAbroad": "Dean Rusk program sends ~60% of students abroad. Strong partnerships in Europe and Latin America. Language study integrated.",
        "lawSchoolDetail": "Pre-law advising rated among best at small liberal arts colleges. Mock trial program active. Strong alumni network in law.",
        "swimDetail": "Coach tenure 8 years. DIII program competes in Southern Athletic Association. Team culture described as academically serious.",
        "notableFacts": "Honor code culture. All-in residential experience. Strong alumni loyalty. Ranked top 10 LAC consistently."
      }
    }
  ]
}
```

---

### 3.3 Financial Import

**File naming:** `financial_YYYY-MM-DD.json`

```json
{
  "source": "financial",
  "collectedAt": "2026-03-29T10:00:00Z",
  "schools": [
    {
      "name": "Davidson College",
      "publishedCOA": 72400,
      "tuition": 57200,
      "roomAndBoard": 13800,
      "feesAndOther": 1400,
      "athleticAidAvailable": false
    }
  ]
}
```

---

### 3.4 Scorecard import

Population script: `scripts/scorecard-import.ts` (reads `School` rows from the DB, queries the [College Scorecard API](https://api.data.gov/ed/collegescorecard/v1/schools.json), writes this file). **File naming:** `scorecard_YYYY-MM-DD.json`

```json
{
  "source": "scorecard",
  "collectedAt": "2026-03-29T10:00:00Z",
  "schools": [
    {
      "name": "Davidson College",
      "state": "NC",
      "scorecardId": 198385,
      "city": "Davidson",
      "latitude": 35.499767,
      "longitude": -80.843979,
      "acceptanceRate": 13.37,
      "satMid50Low": 1400,
      "satMid50High": 1530,
      "satMathMid50Low": 710,
      "satMathMid50High": 780,
      "satEBRWMid50Low": 690,
      "satEBRWMid50High": 750,
      "enrollmentSize": 1867,
      "setting": "Large suburb",
      "retentionRate": 94.61,
      "gradRate4Year": 91.07,
      "studentFacultyRatio": 9,
      "dataCollectedAt": "2026-03-29T10:00:00Z",
      "publishedCOA": 79475,
      "averageAnnualCost": 28500,
      "tuition": 64410,
      "roomAndBoard": 17100,
      "feesAndOther": 2750
    }
  ]
}
```

- **`state`:** Included so `POST /api/import` can reject a row if it does not match the `School.state` in the database (parity with script matching).
- **School fields:** `scorecardId` (API `id`), `city`, `latitude`, `longitude`. Omit keys the API did not supply; the script logs which Prisma-aligned fields were null.
- **AcademicProfile fields (subset):** `acceptanceRate` (percent 0–100), `satMid50Low` / `satMid50High` (composite SAT: math + EBRW at 25th / 75th percentiles), `satMathMid50Low` / `satMathMid50High` (Math section 25th / 75th), `satEBRWMid50Low` / `satEBRWMid50High` (EBRW section 25th / 75th), `enrollmentSize`, `setting` (from `school.locale` via IPEDS-style locale codes, e.g. 21 → “Large suburb”), `retentionRate`, `gradRate4Year`, `studentFacultyRatio`, optional `dataCollectedAt`.
- **FinancialModel fields (subset):** `publishedCOA` from `latest.cost.attendance.academic_year`; `tuition` from the greater of `latest.cost.tuition.in_state` and `latest.cost.tuition.out_of_state` when only one cohort applies; `roomAndBoard` from `latest.cost.roomboard.oncampus`; `feesAndOther` from `latest.cost.booksupply` + `latest.cost.otherexpense.oncampus` (or `offcampus` / `withfamily` fallbacks when on-campus is null). Merit aid fields are omitted unless a later mapping is added from the Scorecard data dictionary.

Matching for the script is by **state** plus a deterministic **name** comparison (`normalizeForScorecardMatch` in [`lib/import/scorecard-name-match.ts`](../../lib/import/scorecard-name-match.ts): dashes/` at `, `&`, optional leading **The**, common branch suffixes, parenthetical disambiguators, etc.) and explicit **display-title overrides** in [`lib/import/scorecard-institution-overrides.ts`](../../lib/import/scorecard-institution-overrides.ts) when Scorecard still uses a different official name (e.g. Notre Dame, Columbia’s full legal title, Virginia Tech). Optional **extra search queries** (e.g. short tokens) run only when the canonical name finds zero matches, never after an ambiguous multi-hit. **Ambiguous or zero API rows after filtering: skip and log — no guessing.**

---

## 4. Derived Fields

These fields are calculated by the application on import or on demand — they are never entered manually or imported directly.

| Field | Model | Logic |
|---|---|---|
| distanceFromHome | School | Haversine formula from school lat/lng to Round Rock, TX (30.5083° N, 97.6789° W) |
| athleticTier | SwimData | teamPowerIndexAvg ≥ 35 → "Recruit target"; 20–34 → "Walk-on possible"; < 20 → "Below threshold" |
| estimatedNetCost | FinancialModel | publishedCOA − estimatedMeritAid − estimatedAthleticAid |
| fourYearEstimate | FinancialModel | estimatedNetCost × 4 |
| athleticAidAvailable | FinancialModel | true only if division resolves to DI or DII (including SwimCloud `Division 1` / `Division 2` after normalization); false for DIII and NAIA |

---

## 5. Seed Data

The initial database seed populates the School table with all ~155 schools from the IR & Law School Preparation list (Version 2). Seed fields populated at initialization:

- name
- state
- city (where known)
- institutionType
- lifecycleStatus (all default to "Research")
- All boolean flags (all default to false)

All other fields are null at seed time and populated via Cowork import or manual entry.

**Seed file location:** `/prisma/seed.ts`

---

## 6. Field Validation Rules

| Rule | Fields |
|---|---|
| lifecycleStatus must be one of defined enum values | School.lifecycleStatus |
| rejectionReason only valid when lifecycleStatus = "Rejected" | School.rejectionReason |
| athleticAidAvailable must be false for DIII and NAIA | FinancialModel.athleticAidAvailable |
| estimatedNetCost cannot be negative | FinancialModel.estimatedNetCost |
| powerIndex values must be between 1 and 100 | SwimData.teamPowerIndexAvg |
| acceptanceRate must be between 0 and 100 | AcademicProfile.acceptanceRate |
| satMid50Low must be less than satMid50High | AcademicProfile |
| AppSettings has exactly one row | AppSettings |

---

## 7. V2 Fields Reserved in Schema

These fields are defined in the schema now but not surfaced in the V1 UI. They are available for V2 without a migration.

| Field | Model | V2 Feature |
|---|---|---|
| appDeadlineEA | School | Deadline management view |
| appDeadlineED | School | Deadline management view |
| appDeadlineRD | School | Deadline management view |
| rawContent | CoachContact | Gmail connector import |
| draftedReply | CoachContact | Gmail response drafting |

---

*This document is the authoritative data contract for V1. Schema changes require updating this document first. Cowork task prompts and import parsers should be written against the JSON structures defined in Section 3.*
