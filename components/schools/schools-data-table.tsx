"use client";

import * as React from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import Link from "next/link";
import { ArrowUpDown, ChevronDown, Star } from "lucide-react";
import { toast } from "sonner";

import type { SchoolListRow } from "@/lib/types/school-list";
import { prospectChancesFromAthleticTier } from "@/lib/derived";
import { invalidateSchoolStatusCounts } from "@/lib/school-status-counts";
import {
  schoolStatusDotClassName,
  schoolStatusLabel,
  schoolStatusSelectTriggerClassName,
} from "@/lib/school-status-ui";
import { cn } from "@/lib/utils";
import { SCHOOL_STATUSES, REJECTION_REASONS, type SchoolStatus } from "@/lib/validation/school";
import { ProspectChancesBadge } from "@/components/schools/prospect-chances-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

/** Human-readable label for the Columns menu (matches table headers, not raw column ids). */
function getColumnMenuLabel(columnId: string): string {
  const map: Record<string, string> = {
    name: "Name",
    state: "State",
    city: "City",
    athleticTier: "Swim Odds",
    satAvg: "SAT Avg",
    publishedCOA: "COA",
    distanceFromHome: "Scipio",
    email: "Email",
    swimcloudInterest: "Swimcloud Interest",
    phoneCall: "Phone Call",
    campusVisit: "Campus Visit",
    favorite: "Favorite",
    status: "Status",
    rejectionReason: "Reason",
  };
  return map[columnId] ?? columnId;
}

function yesNoPillClassName(on: boolean) {
  return on
    ? "rounded-full border-violet-500/40 bg-violet-500/15 text-violet-950 shadow-none dark:border-violet-500/30 dark:bg-violet-500/20 dark:text-violet-100"
    : "rounded-full border-transparent bg-secondary text-secondary-foreground";
}

/** Clickable filter control: active = primary (`default`), inactive = `secondary`. */
function ActivityFilterToggleBadge({
  active,
  onToggle,
  children,
  "aria-label": ariaLabel,
}: {
  active: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  "aria-label"?: string;
}) {
  return (
    <Badge
      role="switch"
      aria-checked={active}
      aria-label={ariaLabel}
      tabIndex={0}
      variant={active ? "default" : "secondary"}
      className={cn(
        "inline-flex cursor-pointer select-none rounded-full font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      )}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle();
        }
      }}
    >
      {children}
    </Badge>
  );
}

function formatPatchError(data: unknown): string {
  if (typeof data === "object" && data !== null && "issues" in data) {
    const issues = (data as {
      issues?: { fieldErrors?: Record<string, string[]>; formErrors?: string[] };
    }).issues;
    const lines = [...(issues?.formErrors ?? [])];
    for (const [k, v] of Object.entries(issues?.fieldErrors ?? {})) {
      if (Array.isArray(v) && v.length) lines.push(`${k}: ${v.join(", ")}`);
    }
    return lines.join("; ") || "Could not save status";
  }
  if (typeof data === "object" && data !== null && "error" in data) {
    return String((data as { error: unknown }).error);
  }
  return "Could not save status";
}

type SchoolsDataTableProps = {
  data: SchoolListRow[];
  /** When set, only these rows are shown (sidebar / URL filter). When unset, rejected schools are excluded; use the Rejected filter to see them. */
  statusFilter?: SchoolStatus | null;
  userSatComposite?: number | null;
};

const COLUMN_VISIBILITY_STORAGE_KEY = "schools-table-column-visibility-v1";
const DEFAULT_COLUMN_VISIBILITY: VisibilityState = {
  favorite: true,
  email: false,
  swimcloudInterest: false,
  phoneCall: false,
  campusVisit: false,
};

const ACTIVITY_FILTERS_STORAGE_KEY = "schools-table-activity-filters-v1";

type ActivityFilters = {
  favorite: boolean;
  email: boolean;
  swimcloudInterest: boolean;
  phoneCall: boolean;
  campusVisit: boolean;
};

const DEFAULT_ACTIVITY_FILTERS: ActivityFilters = {
  favorite: false,
  email: false,
  swimcloudInterest: false,
  phoneCall: false,
  campusVisit: false,
};

function readActivityFilters(): ActivityFilters {
  if (typeof window === "undefined") return DEFAULT_ACTIVITY_FILTERS;
  try {
    const raw = window.localStorage.getItem(ACTIVITY_FILTERS_STORAGE_KEY);
    if (!raw) return DEFAULT_ACTIVITY_FILTERS;
    const p = JSON.parse(raw) as Partial<ActivityFilters>;
    return {
      favorite: Boolean(p.favorite),
      email: Boolean(p.email),
      swimcloudInterest: Boolean(p.swimcloudInterest),
      phoneCall: Boolean(p.phoneCall),
      campusVisit: Boolean(p.campusVisit),
    };
  } catch {
    return DEFAULT_ACTIVITY_FILTERS;
  }
}

export function SchoolsDataTable({ data, statusFilter = null, userSatComposite = null }: SchoolsDataTableProps) {
  const [rows, setRows] = React.useState<SchoolListRow[]>(data);
  const [sorting, setSorting] = React.useState<SortingState>([{ id: "name", desc: false }]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>(() => {
    if (typeof window === "undefined") return DEFAULT_COLUMN_VISIBILITY;
    try {
      const raw = window.localStorage.getItem(COLUMN_VISIBILITY_STORAGE_KEY);
      if (!raw) return DEFAULT_COLUMN_VISIBILITY;
      const parsed = JSON.parse(raw) as VisibilityState;
      return { ...DEFAULT_COLUMN_VISIBILITY, ...parsed };
    } catch {
      return DEFAULT_COLUMN_VISIBILITY;
    }
  });
  const [savingIds, setSavingIds] = React.useState<Set<string>>(() => new Set());
  const [tableError, setTableError] = React.useState<string | null>(null);
  const [activityFilters, setActivityFilters] = React.useState<ActivityFilters>(() => readActivityFilters());
  const [rejectDialogRow, setRejectDialogRow] = React.useState<SchoolListRow | null>(null);
  const [rejectReason, setRejectReason] = React.useState<string>("");

  React.useEffect(() => {
    setRows(data);
  }, [data]);

  React.useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) {
      setColumnVisibility((prev) => ({
        ...prev,
        city: false,
        athleticTier: false,
        satAvg: false,
        publishedCOA: false,
        distanceFromHome: false,
      }));
    }
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(COLUMN_VISIBILITY_STORAGE_KEY, JSON.stringify(columnVisibility));
  }, [columnVisibility]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(ACTIVITY_FILTERS_STORAGE_KEY, JSON.stringify(activityFilters));
  }, [activityFilters]);

  const displayRows = React.useMemo(() => {
    let filtered = rows;
    if (statusFilter) {
      filtered = filtered.filter((r) => r.status === statusFilter);
    } else {
      filtered = filtered.filter((r) => r.status !== "Rejected");
    }
    if (activityFilters.favorite) filtered = filtered.filter((r) => r.abigailFavorite);
    if (activityFilters.email) filtered = filtered.filter((r) => r.hasEmails);
    if (activityFilters.swimcloudInterest) filtered = filtered.filter((r) => r.interested);
    if (activityFilters.phoneCall) filtered = filtered.filter((r) => r.phoneCall);
    if (activityFilters.campusVisit) filtered = filtered.filter((r) => r.campusVisit);
    return filtered;
  }, [rows, statusFilter, activityFilters]);

  const setSaving = React.useCallback((id: string, on: boolean) => {
    setSavingIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const patchSchool = React.useCallback(async (id: string, body: Record<string, unknown>) => {
    const res = await fetch(`/api/schools/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const resData: unknown = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false as const, message: formatPatchError(resData) };
    }
    return { ok: true as const, payload: resData as { updatedAt: string } };
  }, []);

  const applyRowUpdate = React.useCallback((id: string, patch: Partial<SchoolListRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }, []);

  const onFavoriteToggle = React.useCallback(
    async (row: SchoolListRow) => {
      const next = !row.abigailFavorite;
      const previous = row.abigailFavorite;
      applyRowUpdate(row.id, { abigailFavorite: next });
      setTableError(null);
      const result = await patchSchool(row.id, { abigailFavorite: next });
      if (!result.ok) {
        setTableError(result.message);
        toast.error(result.message);
        applyRowUpdate(row.id, { abigailFavorite: previous });
        return;
      }
      toast.success(next ? "Favorited." : "Unfavorited.");
      applyRowUpdate(row.id, { updatedAt: String(result.payload.updatedAt) });
    },
    [applyRowUpdate, patchSchool],
  );

  const onStatusChange = React.useCallback(
    async (row: SchoolListRow, newStatus: (typeof SCHOOL_STATUSES)[number]) => {
      if (newStatus === row.status) return;

      if (newStatus === "Rejected") {
        if (row.rejectionReason) {
          setSaving(row.id, true);
          setTableError(null);
          const result = await patchSchool(row.id, { status: "Rejected" });
          setSaving(row.id, false);
          if (!result.ok) {
            setTableError(result.message);
            toast.error(result.message);
            return;
          }
          toast.success("Status updated.");
          applyRowUpdate(row.id, { status: "Rejected", updatedAt: String(result.payload.updatedAt) });
          invalidateSchoolStatusCounts();
          return;
        }
        setRejectDialogRow(row);
        setRejectReason("");
        return;
      }

      setSaving(row.id, true);
      setTableError(null);
      const result = await patchSchool(row.id, { status: newStatus });
      setSaving(row.id, false);
      if (!result.ok) {
        setTableError(result.message);
        toast.error(result.message);
        return;
      }
      toast.success("Status updated.");
      applyRowUpdate(row.id, {
        status: newStatus,
        rejectionReason: null,
        updatedAt: String(result.payload.updatedAt),
      });
    },
    [applyRowUpdate, patchSchool, setSaving],
  );

  const confirmRejectDialog = React.useCallback(async () => {
    if (!rejectDialogRow || !rejectReason) return;
    setSaving(rejectDialogRow.id, true);
    setTableError(null);
    const result = await patchSchool(rejectDialogRow.id, {
      status: "Rejected",
      rejectionReason: rejectReason,
    });
    setSaving(rejectDialogRow.id, false);
    if (!result.ok) {
      setTableError(result.message);
      toast.error(result.message);
      return;
    }
    toast.success("Status updated.");
    applyRowUpdate(rejectDialogRow.id, {
      status: "Rejected",
      rejectionReason: rejectReason,
      updatedAt: String(result.payload.updatedAt),
    });
    invalidateSchoolStatusCounts();
    setRejectDialogRow(null);
    setRejectReason("");
  }, [applyRowUpdate, patchSchool, rejectDialogRow, rejectReason, setSaving]);

  const isRejectedView = statusFilter === "Rejected";

  const columns = React.useMemo<ColumnDef<SchoolListRow>[]>(
    () => {
      const favoriteCol: ColumnDef<SchoolListRow> = {
        id: "favorite",
        accessorFn: (r) => r.abigailFavorite,
        size: 44,
        header: () => <span className="sr-only">Favorite</span>,
        cell: ({ row }) => {
          const r = row.original;
          return (
            <button
              type="button"
              className="-m-1 rounded p-1 text-amber-400 transition-colors hover:text-amber-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              aria-label={r.abigailFavorite ? "Remove from favorites" : "Add to favorites"}
              onClick={(e) => {
                e.stopPropagation();
                void onFavoriteToggle(r);
              }}
            >
              <Star
                className={cn("size-5", r.abigailFavorite ? "fill-amber-400" : "fill-none")}
                aria-hidden
              />
            </button>
          );
        },
      };

      const nameCol: ColumnDef<SchoolListRow> = {
        accessorKey: "name",
        header: ({ column }) => (
          <Button
            variant="ghost"
            className="-ml-3 h-8 px-2 lg:px-3"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Name
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Link
              href={`/schools/${row.original.id}`}
              className="inline-block max-w-[min(100%,14rem)] truncate font-medium text-primary hover:underline sm:max-w-[20rem] md:max-w-none"
            >
              {row.getValue("name")}
            </Link>
            {row.original.hasAiSummary ? (
              <Badge
                variant="outline"
                className="flex size-5 shrink-0 items-center justify-center border-violet-600/50 bg-violet-600 p-0 font-mono text-[0.65rem] leading-none text-white dark:border-violet-500/60 dark:bg-violet-600"
                title="Executive summary generated"
                aria-label="Executive summary generated"
              >
                S
              </Badge>
            ) : null}
            {!row.original.enrichmentComplete && (
              <Badge variant="warning" className="shrink-0">Enriching</Badge>
            )}
          </div>
        ),
      };

      const stateCol: ColumnDef<SchoolListRow> = {
        accessorKey: "state",
        header: ({ column }) => (
          <Button
            variant="ghost"
            className="-ml-3 h-8 px-2 lg:px-3"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            State
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
      };

      const cityCol: ColumnDef<SchoolListRow> = {
        accessorKey: "city",
        header: "City",
        cell: ({ row }) => row.getValue("city") ?? "—",
      };

      const rejectionReasonCol: ColumnDef<SchoolListRow> = {
        accessorKey: "rejectionReason",
        header: "Reason",
        cell: ({ row }) => (
          <span className="text-sm">{row.original.rejectionReason ?? "—"}</span>
        ),
      };

      const cols: ColumnDef<SchoolListRow>[] = [favoriteCol, nameCol];
      if (isRejectedView) {
        cols.push(rejectionReasonCol);
      } else {
        cols.push(stateCol, cityCol);
      }

      cols.push(
        {
          accessorKey: "athleticTier",
          header: ({ column }) => (
            <Button
              variant="ghost"
              className="-ml-3 h-8 px-2 lg:px-3"
              onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            >
              Swim Odds
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          ),
          cell: ({ row }) => {
            const t = row.original.athleticTier;
            return prospectChancesFromAthleticTier(t) ? (
              <ProspectChancesBadge athleticTier={t} />
            ) : (
              <span className="text-muted-foreground text-sm">—</span>
            );
          },
        },
        {
          accessorKey: "satAvg",
          header: ({ column }) => (
            <Button
              variant="ghost"
              className="-ml-3 h-8 px-2 lg:px-3"
              onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            >
              SAT Avg
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          ),
          cell: ({ row }) => {
            const avg = row.original.satAvg;
            if (avg == null) return <span className="text-muted-foreground text-sm">—</span>;
            const isHigh = userSatComposite != null && avg > userSatComposite + 100;
            return (
              <Badge
                variant="outline"
                className={cn(
                  "rounded-full",
                  isHigh
                    ? "border-red-500/40 bg-red-500/10 text-red-900 dark:border-red-500/30 dark:text-red-200"
                    : "border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:border-emerald-500/30 dark:text-emerald-200",
                )}
              >
                {avg}
              </Badge>
            );
          },
        },
        {
          accessorKey: "publishedCOA",
          header: ({ column }) => (
            <Button
              variant="ghost"
              className="-ml-3 h-8 px-2 lg:px-3"
              onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            >
              COA
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          ),
          cell: ({ row }) => {
            const cost = row.original.publishedCOA;
            if (cost == null) return <span className="text-muted-foreground text-sm">—</span>;
            return (
              <span className="text-sm tabular-nums">
                {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cost)}
              </span>
            );
          },
        },
        {
          accessorKey: "distanceFromHome",
          header: ({ column }) => (
            <Button
              variant="ghost"
              className="-ml-3 h-8 px-2 lg:px-3"
              onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            >
              Scipio
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          ),
          cell: ({ row }) => {
            const d = row.original.distanceFromHome;
            if (d == null) return <span className="text-muted-foreground text-sm">—</span>;
            return <span className="text-sm tabular-nums">{Math.round(d)} mi</span>;
          },
        },
        {
          id: "email",
          accessorFn: (row) => row.hasEmails,
          header: "Email",
          cell: ({ row }) => {
            const on = row.original.hasEmails;
            return (
              <Badge variant="outline" className={cn("font-medium", yesNoPillClassName(on))}>
                {on ? "Yes" : "No"}
              </Badge>
            );
          },
        },
        {
          id: "swimcloudInterest",
          accessorFn: (row) => row.interested,
          header: "Swimcloud Interest",
          cell: ({ row }) => {
            const on = row.original.interested;
            return (
              <Badge variant="outline" className={cn("font-medium", yesNoPillClassName(on))}>
                {on ? "Yes" : "No"}
              </Badge>
            );
          },
        },
        {
          accessorKey: "phoneCall",
          header: "Phone Call",
          cell: ({ row }) => {
            const on = row.original.phoneCall;
            return (
              <Badge variant="outline" className={cn("font-medium", yesNoPillClassName(on))}>
                {on ? "Yes" : "No"}
              </Badge>
            );
          },
        },
        {
          accessorKey: "campusVisit",
          header: "Campus Visit",
          cell: ({ row }) => {
            const on = row.original.campusVisit;
            return (
              <Badge variant="outline" className={cn("font-medium", yesNoPillClassName(on))}>
                {on ? "Yes" : "No"}
              </Badge>
            );
          },
        },
        {
          accessorKey: "status",
          header: "Status",
          cell: ({ row }) => {
            const r = row.original;
            const busy = savingIds.has(r.id);
            return (
              <Select
                value={r.status}
                disabled={busy}
                onValueChange={(v) => void onStatusChange(r, v as (typeof SCHOOL_STATUSES)[number])}
              >
                <SelectTrigger
                  className={cn(
                    "h-8 w-full max-w-[9.25rem] min-w-[7rem] sm:w-[9.25rem] [&>span]:line-clamp-none",
                    schoolStatusSelectTriggerClassName(r.status as SchoolStatus),
                  )}
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    <span
                      className={cn("size-2 shrink-0 rounded-full", schoolStatusDotClassName(r.status as SchoolStatus))}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 truncate text-left">
                      <SelectValue placeholder="Status" />
                    </span>
                  </span>
                </SelectTrigger>
                <SelectContent align="start">
                  {SCHOOL_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      <span className="flex items-center gap-2">
                        <span className={cn("size-2 shrink-0 rounded-full", schoolStatusDotClassName(s))} aria-hidden />
                        {schoolStatusLabel(s)}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            );
          },
        },
      );

      return cols;
    },
    [isRejectedView, onFavoriteToggle, onStatusChange, savingIds],
  );

  const table = useReactTable({
    data: displayRows,
    columns,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    state: {
      sorting,
      columnVisibility,
    },
  });

  return (
    <div className="min-w-0 space-y-4">
      {tableError ? (
        <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">{tableError}</div>
      ) : null}

      <p className="text-sm font-medium">
        {table.getRowModel().rows.length} school{table.getRowModel().rows.length !== 1 ? "s" : ""}
      </p>

      <div className="flex w-full min-w-0 items-center gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <ActivityFilterToggleBadge
            active={activityFilters.favorite}
            onToggle={() => setActivityFilters((p) => ({ ...p, favorite: !p.favorite }))}
            aria-label="Filter to favorited schools"
          >
            Favorite
          </ActivityFilterToggleBadge>
          <ActivityFilterToggleBadge
            active={activityFilters.email}
            onToggle={() => setActivityFilters((p) => ({ ...p, email: !p.email }))}
            aria-label="Filter to schools with matching email"
          >
            Matching Email
          </ActivityFilterToggleBadge>
          <ActivityFilterToggleBadge
            active={activityFilters.swimcloudInterest}
            onToggle={() => setActivityFilters((p) => ({ ...p, swimcloudInterest: !p.swimcloudInterest }))}
            aria-label="Filter to schools with Swimcloud interest"
          >
            Swimcloud Interest
          </ActivityFilterToggleBadge>
          <ActivityFilterToggleBadge
            active={activityFilters.phoneCall}
            onToggle={() => setActivityFilters((p) => ({ ...p, phoneCall: !p.phoneCall }))}
            aria-label="Filter to schools with phone call logged"
          >
            Phone Call
          </ActivityFilterToggleBadge>
          <ActivityFilterToggleBadge
            active={activityFilters.campusVisit}
            onToggle={() => setActivityFilters((p) => ({ ...p, campusVisit: !p.campusVisit }))}
            aria-label="Filter to schools with campus visit logged"
          >
            Campus Visit
          </ActivityFilterToggleBadge>
        </div>
        <div className="shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="shrink-0">
                Columns <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {table
                .getAllColumns()
                .filter((column) => column.getCanHide())
                .map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) => column.toggleVisibility(!!value)}
                  >
                    {getColumnMenuLabel(column.id)}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className="w-full min-w-0 rounded-md border">
        <Table className="min-w-[720px]">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  No schools match this filter.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <p className="text-sm text-muted-foreground">
        Showing {table.getRowModel().rows.length} of {displayRows.length} schools
        {statusFilter != null ? ` (${rows.length} total)` : ""}.
      </p>

      <Dialog open={!!rejectDialogRow} onOpenChange={(open) => !open && setRejectDialogRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejection reason</DialogTitle>
            <DialogDescription>
              Choose a reason to set this school to <strong>Rejected</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Reason</Label>
            <Select
              value={rejectReason || "_placeholder"}
              onValueChange={(v) => setRejectReason(v === "_placeholder" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select reason…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_placeholder" disabled>
                  Select reason…
                </SelectItem>
                {REJECTION_REASONS.map((reason) => (
                  <SelectItem key={reason} value={reason}>
                    {reason}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setRejectDialogRow(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void confirmRejectDialog()}
              disabled={!rejectReason || (rejectDialogRow ? savingIds.has(rejectDialogRow.id) : false)}
            >
              {rejectDialogRow && savingIds.has(rejectDialogRow.id) ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
