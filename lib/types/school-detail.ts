/** Shape returned by GET /api/schools/[id] after JSON parse (dates are ISO strings). */

export type SchoolDetailCoachContact = {
  id: string;
  date: string;
  direction: string;
  type: string;
  summary: string;
  createdAt: string;
  updatedAt: string;
};

export type SchoolDetailJson = {
  id: string;
  name: string;
  state: string;
  city: string | null;
  institutionType: string;
  latitude: number | null;
  longitude: number | null;
  distanceFromHome: number | null;
  status: string;
  rejectionReason: string | null;
  abigailFavorite: boolean;
  interested: boolean;
  email: boolean;
  phoneCall: boolean;
  campusVisit: boolean;
  enrichmentComplete: boolean;
  hasEmails: boolean;
  notes: string | null;
  aiSummary: string | null;
  summaryGeneratedAt: string | null;
  appDeadlineEA: string | null;
  appDeadlineED: string | null;
  appDeadlineRD: string | null;
  createdAt: string;
  updatedAt: string;
  swimData: Record<string, unknown> | null;
  academicProfile: Record<string, unknown> | null;
  financialModel: Record<string, unknown> | null;
  coachContacts: SchoolDetailCoachContact[];
};
