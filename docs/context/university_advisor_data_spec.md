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
  powerIndex8th     Float?    // 8th-place swimmer — positioning proxy
  abigailRank       Int?      // Her projected rank on this roster

  // Roster
  rosterSize        Int?
  seniorsGraduating Int?      // Current year graduating seniors

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
| powerIndex8th | SwimCloud | Cowork import |
| abigailRank | SwimCloud | Cowork import |
| rosterSize | SwimCloud | Cowork import |
| seniorsGraduating | SwimCloud | Cowork import |
| swimcloudUrl | SwimCloud | Cowork import |
| dataCollectedAt | Cowork | Set on import |

**Athletic tier derivation logic:**

```
teamPowerIndexAvg >= 35  →  "Recruit target"
teamPowerIndexAvg 20–34  →  "Walk-on possible"
teamPowerIndexAvg < 20   →  "Below threshold" (school removed from active list)
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

  // Primary major flexibility
  majorFlexibility    String?   // Notes on ability to explore/discover primary major

  // Academics
  acceptanceRate      Float?    // Overall institutional acceptance rate (percentage)
  satMid50Low         Int?      // SAT mid-50% lower bound
  satMid50High        Int?      // SAT mid-50% upper bound
  enrollmentSize      Int?      // Total undergraduate enrollment
  setting             String?   // "Urban" | "Suburban" | "Rural" | "College town"
  retentionRate       Float?    // First-year retention rate (percentage)
  gradRate4Year       Float?    // Four-year graduation rate (percentage)
  studentFacultyRatio Float?    // e.g. 10 for 10:1

  // Law school outcomes
  lawSchoolAcceptRate Float?    // Percentage of applicants accepted to law school
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
| majorFlexibility | Cowork | Cowork import |
| acceptanceRate | Common Data Set / US News | Cowork import |
| satMid50Low/High | Common Data Set / US News | Cowork import |
| enrollmentSize | US News / school | Cowork import |
| setting | School website | Cowork import |
| retentionRate | US News | Cowork import |
| gradRate4Year | US News | Cowork import |
| studentFacultyRatio | US News | Cowork import |
| lawSchoolAcceptRate | School reported / ABA | Cowork import |
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
  meritAidAvailable     Boolean?  // Does this school offer merit aid?
  meritAidThreshold     String?   // GPA/SAT range where aid becomes available
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
| tuition | School financial aid page | Cowork import |
| roomAndBoard | School financial aid page | Cowork import |
| feesAndOther | School financial aid page | Cowork import |
| meritAidAvailable | School financial aid page | Cowork import |
| meritAidThreshold | School financial aid page | Cowork import |
| estimatedMeritAid | Parent judgment | Manual in app |
| athleticAidAvailable | Division rules | Derived from ncaaDivision |
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

## 3. Cowork Import Contract

Cowork outputs structured JSON files to `/data/imports/`. The app exposes a Next.js API route at `POST /api/import` that reads a file, matches on school name, and upserts fields. Source files are retained after import for audit purposes.

**One file per data source. Three source types in V1:**

---

### 3.1 SwimCloud Import

**File naming:** `swimcloud_YYYY-MM-DD.json`

```json
{
  "source": "swimcloud",
  "collectedAt": "2026-03-29T10:00:00Z",
  "schools": [
    {
      "name": "Davidson College",
      "ncaaDivision": "DIII",
      "hasSwimTeam": true,
      "teamPowerIndexAvg": 44.2,
      "powerIndex8th": 52.1,
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
      "majorFlexibility": "Open curriculum allows major discovery through sophomore year",
      "acceptanceRate": 19.2,
      "satMid50Low": 1340,
      "satMid50High": 1500,
      "enrollmentSize": 1950,
      "setting": "College town",
      "retentionRate": 95.0,
      "gradRate4Year": 91.0,
      "studentFacultyRatio": 10,
      "lawSchoolAcceptRate": 78.0,
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
      "meritAidAvailable": true,
      "meritAidThreshold": "Top 25% of applicant pool; approximately 3.9 GPA / 1450 SAT",
      "athleticAidAvailable": false
    }
  ]
}
```

---

## 4. Derived Fields

These fields are calculated by the application on import or on demand — they are never entered manually or imported directly.

| Field | Model | Logic |
|---|---|---|
| distanceFromHome | School | Haversine formula from school lat/lng to Round Rock, TX (30.5083° N, 97.6789° W) |
| athleticTier | SwimData | teamPowerIndexAvg ≥ 35 → "Recruit target"; 20–34 → "Walk-on possible"; < 20 → "Below threshold" |
| estimatedNetCost | FinancialModel | publishedCOA − estimatedMeritAid − estimatedAthleticAid |
| fourYearEstimate | FinancialModel | estimatedNetCost × 4 |
| athleticAidAvailable | FinancialModel | true only if ncaaDivision = "DI" or "DII" |

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
| powerIndex values must be between 1 and 100 | SwimData.teamPowerIndexAvg, powerIndex8th |
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
