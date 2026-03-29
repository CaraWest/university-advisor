"use client";

import * as React from "react";

import type { SchoolListRow } from "@/lib/types/school-list";
import { SchoolsDataTable } from "@/components/schools/schools-data-table";

export function SchoolsPageClient() {
  const [rows, setRows] = React.useState<SchoolListRow[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/schools");
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        const data: unknown = await res.json();
        if (!Array.isArray(data)) throw new Error("Invalid response shape");
        if (!cancelled) setRows(data as SchoolListRow[]);
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
    return <p className="text-sm text-muted-foreground">Loading schools…</p>;
  }

  return <SchoolsDataTable data={rows} />;
}
