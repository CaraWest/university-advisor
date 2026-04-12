import type { SchoolStatus } from "@/lib/validation/school";

import { cn } from "@/lib/utils";

/** Human-readable label (sidebar, selects, badges). */
export function schoolStatusLabel(status: SchoolStatus): string {
  return status === "None" ? "No status" : status;
}

const TINT: Record<SchoolStatus, string> = {
  None:
    "border-slate-400/45 bg-slate-500/[0.08] text-slate-900 dark:border-slate-500/35 dark:bg-slate-500/12 dark:text-slate-100",
  Shortlisted:
    "border-blue-500/45 bg-blue-500/[0.09] text-blue-950 dark:border-blue-400/35 dark:bg-blue-500/15 dark:text-blue-50",
  Applying:
    "border-amber-500/50 bg-amber-500/[0.1] text-amber-950 dark:border-amber-500/35 dark:bg-amber-500/12 dark:text-amber-100",
  Accepted:
    "border-emerald-500/50 bg-emerald-500/[0.1] text-emerald-950 dark:border-emerald-500/35 dark:bg-emerald-500/12 dark:text-emerald-100",
  Rejected:
    "border-red-500/50 bg-red-500/[0.1] text-red-950 dark:border-red-500/35 dark:bg-red-500/12 dark:text-red-100",
};

/** Colored `<SelectTrigger>` (overrides default border/background). */
export function schoolStatusSelectTriggerClassName(status: SchoolStatus): string {
  return cn("font-medium shadow-sm", TINT[status]);
}

/** Compact pill for map popups and inline status. */
export function schoolStatusBadgeClassName(status: SchoolStatus): string {
  return cn("inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold", TINT[status]);
}

const DOT: Record<SchoolStatus, string> = {
  None: "bg-slate-400 dark:bg-slate-500",
  Shortlisted: "bg-blue-500 dark:bg-blue-400",
  Applying: "bg-amber-500 dark:bg-amber-400",
  Accepted: "bg-emerald-500 dark:bg-emerald-400",
  Rejected: "bg-red-500 dark:bg-red-400",
};

/** Leading dot in select dropdown rows. */
export function schoolStatusDotClassName(status: SchoolStatus): string {
  return DOT[status];
}

const NAV_ICON: Record<SchoolStatus, string> = {
  None: "text-slate-500 dark:text-slate-400",
  Shortlisted: "text-blue-600 dark:text-blue-400",
  Applying: "text-amber-600 dark:text-amber-400",
  Accepted: "text-emerald-600 dark:text-emerald-400",
  Rejected: "text-red-600 dark:text-red-400",
};

/** Tint for sidebar status icons. */
export function schoolStatusNavIconClassName(status: SchoolStatus): string {
  return NAV_ICON[status];
}
