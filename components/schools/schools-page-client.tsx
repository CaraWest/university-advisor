"use client";

import * as React from "react";

import { SchoolsListSkeleton } from "@/components/schools/schools-list-skeleton";
import { SchoolsDataTable } from "@/components/schools/schools-data-table";
import type { SchoolListRow } from "@/lib/types/school-list";
import type { SchoolStatus } from "@/lib/validation/school";

type SchoolsPageClientProps = {
  statusFilter: SchoolStatus | null;
};

export function SchoolsPageClient({ statusFilter }: SchoolsPageClientProps) {
  const [rows, setRows] = React.useState<SchoolListRow[] | null>(null);
  const [userSatComposite, setUserSatComposite] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/schools", { cache: "no-store" });
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        const data = (await res.json()) as { schools: SchoolListRow[]; userSatComposite: number | null };
        if (!cancelled) {
          setRows(data.schools);
          setUserSatComposite(data.userSatComposite);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load schools");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/5 p-4 text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (!rows) {
    return <SchoolsListSkeleton />;
  }

  return <SchoolsDataTable data={rows} statusFilter={statusFilter} userSatComposite={userSatComposite} />;
}
