export type SchoolListRow = {
  id: string;
  name: string;
  state: string;
  city: string | null;
  institutionType: string;
  status: string;
  rejectionReason: string | null;
  /** From SwimData; null when no swim import or tier not yet derived. */
  athleticTier: string | null;
  /** Midpoint of SAT composite mid-50 range; null when no academic data. */
  satAvg: number | null;
  /** Published total cost of attendance; null when unavailable. */
  publishedCOA: number | null;
  /** Miles from Round Rock, TX; null when no coordinates. */
  distanceFromHome: number | null;
  enrichmentComplete: boolean;
  interested: boolean;
  hasEmails: boolean;
  /** Non-empty `aiSummary` (executive summary generated). */
  hasAiSummary: boolean;
  updatedAt: string;
};
