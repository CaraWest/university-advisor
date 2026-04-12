import type { Metadata } from "next";

import { SchoolsPageClient } from "@/components/schools/schools-page-client";
import { parseSchoolListStatusFilter, type SchoolStatus } from "@/lib/validation/school";
import { schoolStatusLabel } from "@/lib/school-status-ui";

type SchoolsPageProps = {
  searchParams: { status?: string | string[] };
};

export function generateMetadata({ searchParams }: SchoolsPageProps): Metadata {
  const statusFilter = parseSchoolListStatusFilter(searchParams.status);
  const title = statusFilter
    ? `${schoolStatusLabel(statusFilter as SchoolStatus)} — Schools`
    : "Schools";
  return { title };
}

export default function SchoolsPage({ searchParams }: SchoolsPageProps) {
  const statusFilter = parseSchoolListStatusFilter(searchParams.status);
  const heading = statusFilter
    ? `Schools — ${schoolStatusLabel(statusFilter as SchoolStatus)}`
    : "Schools";

  return (
    <div className="w-full min-w-0 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">{heading}</h1>
      </div>
      <SchoolsPageClient statusFilter={statusFilter} />
    </div>
  );
}
