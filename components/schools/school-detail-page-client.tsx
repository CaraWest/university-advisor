"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";

import dynamic from "next/dynamic";
import ReactMarkdown from "react-markdown";
import { ArrowDown, ArrowUp, Check, ExternalLink, Info, Minus, Star } from "lucide-react";

import { normalizeExecutiveSummaryLinebreaks } from "@/lib/ai/executive-summary-markdown";
import { athleticAidAvailableFromDivision, prospectChancesExplainer, prospectChancesFromAthleticTier } from "@/lib/derived";
import { parseSwimcloudTeamIdFromUrl, swimcloudTeamCanonicalUrl } from "@/lib/swimcloud-team-id";
import { cn } from "@/lib/utils";
import type { SchoolDetailCoachContact, SchoolDetailJson } from "@/lib/types/school-detail";
import {
  COACH_DIRECTIONS,
  COACH_TYPES,
} from "@/lib/validation/coach-contact";
import { invalidateSchoolStatusCounts } from "@/lib/school-status-counts";
import {
  schoolStatusDotClassName,
  schoolStatusLabel,
  schoolStatusSelectTriggerClassName,
} from "@/lib/school-status-ui";
import { SCHOOL_STATUSES, REJECTION_REASONS, type SchoolStatus } from "@/lib/validation/school";
import { ProspectChancesBadge } from "@/components/schools/prospect-chances-badge";
import { SchoolDetailSkeleton } from "@/components/schools/school-detail-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const SchoolLocationMap = dynamic(
  () => import("@/components/schools/school-location-map").then((m) => ({ default: m.SchoolLocationMap })),
  { ssr: false, loading: () => <div className="h-full min-h-[200px] w-full animate-pulse rounded-md bg-muted" /> },
);

function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function formatApiError(data: unknown): string {
  if (typeof data === "object" && data !== null && "issues" in data) {
    const issues = (data as {
      issues?: { fieldErrors?: Record<string, string[]>; formErrors?: string[] };
    }).issues;
    const lines = [...(issues?.formErrors ?? [])];
    for (const [k, v] of Object.entries(issues?.fieldErrors ?? {})) {
      if (Array.isArray(v) && v.length) lines.push(`${k}: ${v.join(", ")}`);
    }
    return lines.join("; ") || "Validation failed";
  }
  if (typeof data === "object" && data !== null && "error" in data) {
    return String((data as { error: unknown }).error);
  }
  return "Request failed";
}

function EmptyBlurb() {
  return (
    <p className="text-sm text-muted-foreground">
      No data yet. Use <Link href="/import">Import</Link> (JSON in <code className="rounded bg-muted px-1 text-xs">data/imports/</code>
      ) or add details manually.
    </p>
  );
}

function fmtIsoDate(v: unknown): string {
  if (v == null || typeof v !== "string") return "—";
  const t = Date.parse(v);
  return Number.isNaN(t) ? "—" : new Date(t).toLocaleDateString();
}

function formatCurrencyUSD(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function PowerIndexCompareBadge({ user, team }: { user: number; team: number }) {
  const eps = 1e-6;
  let Cmp: typeof ArrowUp = Minus;
  let verb = "equal to team average";
  let variant: "default" | "destructive" | "outline" = "default";
  if (user > team + eps) {
    Cmp = ArrowUp;
    verb = "above team average";
    variant = "destructive";
  } else if (user < team - eps) {
    Cmp = ArrowDown;
    verb = "below team average";
    variant = "outline";
  }
  const ariaLabel = `Your power index ${user}, team average ${team}, ${verb}`;
  return (
    <Badge
      variant={variant}
      className={cn(
        "inline-flex items-center gap-1",
        variant === "outline" &&
          "border-amber-500/40 bg-amber-500/10 text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-100",
      )}
      aria-label={ariaLabel}
    >
      <span>{String(user)}</span>
      <Cmp className="size-3.5 shrink-0" aria-hidden />
    </Badge>
  );
}

type SchoolDetailPageClientProps = {
  schoolId: string;
};

export function SchoolDetailPageClient({ schoolId }: SchoolDetailPageClientProps) {
  const [school, setSchool] = React.useState<SchoolDetailJson | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const [status, setStatus] = React.useState("");
  const [abigailFavorite, setAbigailFavorite] = React.useState(false);
  const [interested, setInterested] = React.useState(false);
  const [email, setEmail] = React.useState(false);
  const [phoneCall, setPhoneCall] = React.useState(false);
  const [campusVisit, setCampusVisit] = React.useState(false);

  const [notes, setNotes] = React.useState("");

  const [sectionError, setSectionError] = React.useState<string | null>(null);
  const [aiSummaryError, setAiSummaryError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState<string | null>(null);
  const [aiSummaryBusy, setAiSummaryBusy] = React.useState(false);

  const [emailDomains, setEmailDomains] = React.useState<{ id: string; domain: string }[]>([]);
  const [newDomain, setNewDomain] = React.useState("");
  const [domainSaving, setDomainSaving] = React.useState(false);
  const [emailDomainRemoveTarget, setEmailDomainRemoveTarget] = React.useState<{
    id: string;
    domain: string;
  } | null>(null);
  const [domainRemoving, setDomainRemoving] = React.useState(false);

  const [rejectDialogOpen, setRejectDialogOpen] = React.useState(false);
  const [rejectReason, setRejectReason] = React.useState("");

  const [contactDialogOpen, setContactDialogOpen] = React.useState(false);
  const [editingContact, setEditingContact] = React.useState<SchoolDetailCoachContact | null>(null);
  const [contactDate, setContactDate] = React.useState("");
  const [contactDirection, setContactDirection] = React.useState<(typeof COACH_DIRECTIONS)[number]>("Inbound");
  const [contactType, setContactType] = React.useState<(typeof COACH_TYPES)[number]>("Email");
  const [contactSummary, setContactSummary] = React.useState("");
  const [userPowerIndex, setUserPowerIndex] = React.useState<number | null>(null);

  const reload = React.useCallback(async () => {
    const res = await fetch(`/api/schools/${schoolId}`, { cache: "no-store" });
    if (res.status === 404) {
      setLoadError("School not found.");
      setSchool(null);
      return;
    }
    if (!res.ok) {
      setLoadError(`Failed to load school (${res.status})`);
      setSchool(null);
      return;
    }
    const data = (await res.json()) as SchoolDetailJson;
    setSchool(data);
    setLoadError(null);
    setStatus(data.status);
    setAbigailFavorite(data.abigailFavorite);
    setInterested(data.interested);
    setEmail(data.email);
    setPhoneCall(data.phoneCall);
    setCampusVisit(data.campusVisit);
    setNotes(data.notes ?? "");
  }, [schoolId]);

  const loadEmailDomains = React.useCallback(async () => {
    const res = await fetch(`/api/schools/${schoolId}/email-domains`);
    if (res.ok) {
      const data = (await res.json()) as { id: string; domain: string }[];
      setEmailDomains(data);
    }
  }, [schoolId]);

  const loadProfile = React.useCallback(async () => {
    const res = await fetch("/api/profile", { cache: "no-store" });
    if (!res.ok) {
      setUserPowerIndex(null);
      return;
    }
    const data = (await res.json()) as { powerIndex?: unknown };
    const pi = data.powerIndex;
    if (typeof pi === "number" && Number.isFinite(pi)) {
      setUserPowerIndex(pi);
    } else {
      setUserPowerIndex(null);
    }
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      await Promise.all([reload(), loadEmailDomains(), loadProfile()]);
    })().catch(() => {
      if (!cancelled) setLoadError("Failed to load school");
    });
    return () => {
      cancelled = true;
    };
  }, [reload, loadEmailDomains, loadProfile]);

  const addEmailDomain = async () => {
    const d = newDomain.trim();
    if (!d) return;
    setDomainSaving(true);
    try {
      const res = await fetch(`/api/schools/${schoolId}/email-domains`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: d }),
      });
      const data: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(
          (data as { error?: string })?.error ?? "Failed to add domain",
        );
        return;
      }
      setNewDomain("");
      await loadEmailDomains();
      toast.success(`Domain "${d}" added`);
    } finally {
      setDomainSaving(false);
    }
  };

  const removeEmailDomain = async (domainId: string): Promise<boolean> => {
    const res = await fetch(
      `/api/schools/${schoolId}/email-domains?domainId=${encodeURIComponent(domainId)}`,
      { method: "DELETE" },
    );
    if (!res.ok) {
      toast.error("Failed to remove domain");
      return false;
    }
    await loadEmailDomains();
    toast.success("Domain removed");
    return true;
  };

  const confirmRemoveEmailDomain = async () => {
    if (!emailDomainRemoveTarget) return;
    setDomainRemoving(true);
    try {
      const ok = await removeEmailDomain(emailDomainRemoveTarget.id);
      if (ok) setEmailDomainRemoveTarget(null);
    } finally {
      setDomainRemoving(false);
    }
  };

  const openNewContact = () => {
    setEditingContact(null);
    setContactDate(toDatetimeLocalValue(new Date().toISOString()));
    setContactDirection("Inbound");
    setContactType("Email");
    setContactSummary("");
    setContactDialogOpen(true);
  };

  const openEditContact = (c: SchoolDetailCoachContact) => {
    setEditingContact(c);
    setContactDate(toDatetimeLocalValue(c.date));
    setContactDirection(c.direction as (typeof COACH_DIRECTIONS)[number]);
    setContactType(c.type as (typeof COACH_TYPES)[number]);
    setContactSummary(c.summary);
    setContactDialogOpen(true);
  };

  const saveContact = async () => {
    setSectionError(null);
    const iso = new Date(contactDate).toISOString();
    if (Number.isNaN(Date.parse(iso))) {
      const msg = "Invalid contact date.";
      setSectionError(msg);
      toast.error(msg);
      return;
    }
    if (!contactSummary.trim()) {
      const msg = "Summary is required.";
      setSectionError(msg);
      toast.error(msg);
      return;
    }
    setSaving("contact");
    try {
      if (editingContact) {
        const res = await fetch(`/api/schools/${schoolId}/contacts/${editingContact.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: iso,
            direction: contactDirection,
            type: contactType,
            summary: contactSummary.trim(),
          }),
        });
        const data: unknown = await res.json().catch(() => ({}));
        if (!res.ok) {
          const msg = formatApiError(data);
          setSectionError(msg);
          toast.error(msg);
          return;
        }
        toast.success("Contact updated.");
      } else {
        const res = await fetch(`/api/schools/${schoolId}/contacts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: iso,
            direction: contactDirection,
            type: contactType,
            summary: contactSummary.trim(),
          }),
        });
        const data: unknown = await res.json().catch(() => ({}));
        if (!res.ok) {
          const msg = formatApiError(data);
          setSectionError(msg);
          toast.error(msg);
          return;
        }
        toast.success("Contact added.");
      }
      setContactDialogOpen(false);
      await reload();
    } finally {
      setSaving(null);
    }
  };

  const deleteContact = async (c: SchoolDetailCoachContact) => {
    if (!window.confirm(`Delete this ${c.type.toLowerCase()} contact from ${new Date(c.date).toLocaleString()}?`)) return;
    setSectionError(null);
    setSaving(`del-${c.id}`);
    try {
      const res = await fetch(`/api/schools/${schoolId}/contacts/${c.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data: unknown = await res.json().catch(() => ({}));
        const msg = formatApiError(data);
        setSectionError(msg);
        toast.error(msg);
        return;
      }
      toast.success("Contact removed.");
      await reload();
    } finally {
      setSaving(null);
    }
  };

  async function runAiSummary() {
    setAiSummaryError(null);
    setAiSummaryBusy(true);
    try {
      const res = await fetch(`/api/schools/${schoolId}/ai-summary`, {
        method: "POST",
      });
      const data: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = formatApiError(data);
        setAiSummaryError(msg);
        toast.error(msg);
        return;
      }
      toast.success("Summary regenerated.");
      await reload();
    } finally {
      setAiSummaryBusy(false);
    }
  }

  async function patchSchool(body: Record<string, unknown>, section: string, successMessage?: string) {
    setSectionError(null);
    setSaving(section);
    try {
      const res = await fetch(`/api/schools/${schoolId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = formatApiError(data);
        setSectionError(msg);
        toast.error(msg);
        return;
      }
      toast.success(successMessage ?? "Saved.");
      if (typeof body === "object" && body !== null && "status" in body) {
        invalidateSchoolStatusCounts();
      }
      await reload();
    } finally {
      setSaving(null);
    }
  }

  if (loadError && !school) {
    return (
      <div className="space-y-4">
        <div className="rounded-md border border-destructive/50 bg-destructive/5 p-4 text-sm text-destructive">{loadError}</div>
        <Button variant="outline" asChild>
          <Link href="/schools">Back to schools</Link>
        </Button>
      </div>
    );
  }

  if (!school) {
    return <SchoolDetailSkeleton />;
  }

  const swim = school.swimData;
  const academic = school.academicProfile;
  const financial = school.financialModel;

  const financialRecord = financial && typeof financial === "object" ? (financial as Record<string, unknown>) : null;
  const publishedCOA =
    financialRecord && typeof financialRecord.publishedCOA === "number" ? financialRecord.publishedCOA : null;
  const scorecardAvgAnnualCost =
    financialRecord && typeof financialRecord.averageAnnualCost === "number"
      ? financialRecord.averageAnnualCost
      : null;
  const dbAthleticAvail =
    financialRecord && typeof financialRecord.athleticAidAvailable === "boolean"
      ? financialRecord.athleticAidAvailable
      : null;
  const swimDivision =
    swim && typeof swim === "object" && typeof (swim as Record<string, unknown>).ncaaDivision === "string"
      ? String((swim as Record<string, unknown>).ncaaDivision)
      : null;
  const athleticAvailEffective =
    dbAthleticAvail !== null ? dbAthleticAvail : athleticAidAvailableFromDivision(swimDivision);
  const swimcloudAvgAnnualCost =
    swim && typeof swim === "object" && typeof (swim as Record<string, unknown>).swimcloudAvgNetCost === "number"
      ? ((swim as Record<string, unknown>).swimcloudAvgNetCost as number)
      : null;

  const ugEnrollmentDisplay =
    academic && typeof academic === "object" && academic.enrollmentSize != null
      ? String(academic.enrollmentSize)
      : "—";
  const swimSchoolSizeLabel =
    swim && typeof swim === "object"
      ? (() => {
          const raw = (swim as Record<string, unknown>).schoolSize;
          return typeof raw === "string" && raw.trim() ? raw.trim() : null;
        })()
      : null;

  const swimcloudUrlForButton =
    swim && typeof swim === "object" && !swim.notInSwimCloud
      ? (() => {
          const url = typeof swim.swimcloudUrl === "string" ? swim.swimcloudUrl.trim() : "";
          if (url.length > 0) return url;
          const tid =
            typeof swim.swimcloudTeamId === "number" && swim.swimcloudTeamId > 0
              ? swim.swimcloudTeamId
              : parseSwimcloudTeamIdFromUrl(typeof swim.swimcloudUrl === "string" ? swim.swimcloudUrl : undefined);
          return tid != null ? swimcloudTeamCanonicalUrl(tid) : null;
        })()
      : null;

  const swimTeamIdForDisplay =
    swim && typeof swim === "object" && !swim.notInSwimCloud
      ? (() => {
          const tid = swim.swimcloudTeamId;
          if (typeof tid === "number" && Number.isInteger(tid) && tid > 0) return tid;
          return (
            parseSwimcloudTeamIdFromUrl(typeof swim.swimcloudUrl === "string" ? swim.swimcloudUrl : undefined) ?? null
          );
        })()
      : null;

  const swimLinkedNoFit =
    swim &&
    typeof swim === "object" &&
    !swim.notInSwimCloud &&
    swim.matchScore == null &&
    swim.teamPowerIndexAvg == null;

  const teamPowerIndexAvg =
    swim && typeof swim === "object" && !swim.notInSwimCloud && swim.teamPowerIndexAvg != null
      ? Number(swim.teamPowerIndexAvg)
      : null;
  const teamPowerIndexAvgFinite =
    teamPowerIndexAvg != null && Number.isFinite(teamPowerIndexAvg) ? teamPowerIndexAvg : null;

  const athleticTierForProspect =
    swim && typeof swim === "object" && typeof swim.athleticTier === "string" ? swim.athleticTier : null;

  return (
    <TooltipProvider delayDuration={200}>
    <div className="space-y-8">
      <Button variant="ghost" size="sm" className="-ml-2 h-8 px-2" asChild>
        <Link href="/schools">← Schools</Link>
      </Button>

      {sectionError ? (
        <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">{sectionError}</div>
      ) : null}

      {aiSummaryError ? (
        <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">{aiSummaryError}</div>
      ) : null}

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
          <div className="space-y-1">
            <CardTitle className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                aria-label={abigailFavorite ? "Remove from favorites" : "Add to favorites"}
                className="text-amber-400 transition-colors hover:text-amber-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
                onClick={() => {
                  const next = !abigailFavorite;
                  setAbigailFavorite(next);
                  void patchSchool({ abigailFavorite: next }, "favorite", next ? "Favorited." : "Unfavorited.");
                }}
              >
                <Star
                  className={cn("size-6", abigailFavorite ? "fill-amber-400" : "fill-none")}
                  aria-hidden
                />
              </button>
              <span className="text-2xl">{school.name}</span>
              {emailDomains.length > 0 && (
                <a
                  href={`https://${emailDomains[0].domain}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-normal text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <ExternalLink className="size-3.5" />
                  {emailDomains[0].domain}
                </a>
              )}
            </CardTitle>
            <CardDescription>
              {school.city ? `${school.city}, ` : ""}
              {school.state}
            </CardDescription>
          </div>
          <div className="shrink-0">
            <Select
              value={status}
              onValueChange={(v) => {
                if (v === "Rejected") {
                  if (school.rejectionReason) {
                    setStatus(v);
                    void patchSchool({ status: v }, "status", "Status updated.");
                  } else {
                    setRejectReason("");
                    setRejectDialogOpen(true);
                  }
                  return;
                }
                setStatus(v);
                void patchSchool({ status: v }, "status", "Status updated.");
              }}
            >
              <SelectTrigger
                className={cn(
                  "w-[160px] [&>span]:line-clamp-none",
                  schoolStatusSelectTriggerClassName(
                    status && (SCHOOL_STATUSES as readonly string[]).includes(status)
                      ? (status as SchoolStatus)
                      : "None",
                  ),
                )}
              >
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  <span
                    className={cn(
                      "size-2 shrink-0 rounded-full",
                      schoolStatusDotClassName(
                        status && (SCHOOL_STATUSES as readonly string[]).includes(status)
                          ? (status as SchoolStatus)
                          : "None",
                      ),
                    )}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate text-left">
                    <SelectValue placeholder="Status" />
                  </span>
                </span>
              </SelectTrigger>
              <SelectContent>
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
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-6 lg:flex-row">
            <dl className="grid flex-1 content-start gap-x-4 gap-y-3 sm:grid-cols-[auto_1fr] sm:items-start">
              <dt className="text-sm text-muted-foreground sm:whitespace-nowrap">Enrollment</dt>
              <dd className="min-w-0 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span>{ugEnrollmentDisplay}</span>
                  {swimSchoolSizeLabel ? (
                    <Badge variant="secondary">{swimSchoolSizeLabel}</Badge>
                  ) : null}
                </div>
              </dd>
              <dt className="text-sm text-muted-foreground sm:whitespace-nowrap">Scipio</dt>
              <dd className="min-w-0 text-sm">
                {school.distanceFromHome != null ? `${Number(school.distanceFromHome).toFixed(1)} mi` : "—"}
              </dd>
              <dt className="flex items-center gap-1.5 text-sm text-muted-foreground sm:whitespace-nowrap">
                <span>Swim Odds</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex rounded-full text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      aria-label="How Swim Odds are determined"
                    >
                      <Info className="size-4 shrink-0" aria-hidden />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-sm text-left whitespace-pre-line">
                    {prospectChancesExplainer()}
                  </TooltipContent>
                </Tooltip>
              </dt>
              <dd className="min-w-0 text-sm">
                {prospectChancesFromAthleticTier(athleticTierForProspect) ? (
                  <ProspectChancesBadge athleticTier={athleticTierForProspect} />
                ) : (
                  "—"
                )}
              </dd>
            </dl>
            {school.latitude != null && school.longitude != null && (
              <div className="w-full lg:w-72 shrink-0">
                <SchoolLocationMap latitude={school.latitude} longitude={school.longitude} />
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex flex-wrap gap-2">
          {(
            [
              { key: "interested", label: "Swimcloud Interest", value: interested, setter: setInterested },
              { key: "email", label: "Email", value: email, setter: setEmail },
              { key: "phoneCall", label: "Phone Call", value: phoneCall, setter: setPhoneCall },
              { key: "campusVisit", label: "Campus Visit", value: campusVisit, setter: setCampusVisit },
            ] as const
          ).map(({ key, label, value, setter }) => (
            <Badge
              key={key}
              role="switch"
              aria-checked={value}
              tabIndex={0}
              className="inline-flex cursor-pointer select-none items-center gap-1 rounded-full transition-colors"
              variant={value ? "default" : "secondary"}
              onClick={() => {
                const next = !value;
                setter(next);
                void patchSchool({ [key]: next }, key, `${label} ${next ? "on" : "off"}.`);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  const next = !value;
                  setter(next);
                  void patchSchool({ [key]: next }, key, `${label} ${next ? "on" : "off"}.`);
                }
              }}
            >
              {value ? <Check className="size-2.5 shrink-0" aria-hidden /> : null}
              {label}
            </Badge>
          ))}
        </CardFooter>
      </Card>

      <Card>
        <CardHeader className="space-y-1">
          <CardTitle>AI executive summary</CardTitle>
          <CardDescription>
            Generated on demand using web research and your student profile.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {school.aiSummary?.trim() ? (
            <>
              <div className="prose prose-sm dark:prose-invert max-w-none leading-relaxed prose-p:my-3 prose-li:my-0.5">
                <ReactMarkdown>
                  {normalizeExecutiveSummaryLinebreaks(school.aiSummary)}
                </ReactMarkdown>
              </div>
              <p className="text-xs text-muted-foreground">
                Generated {school.summaryGeneratedAt ? new Date(school.summaryGeneratedAt).toLocaleString() : ""}
              </p>
              <Button
                variant="outline"
                disabled={aiSummaryBusy}
                onClick={() => {
                  if (!window.confirm("Replace the current summary with a newly generated one?")) return;
                  void runAiSummary();
                }}
              >
                {aiSummaryBusy ? "Working…" : "Regenerate"}
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">No summary yet.</p>
              <Button
                disabled={aiSummaryBusy}
                onClick={() => void runAiSummary()}
              >
                {aiSummaryBusy ? "Working…" : "Generate"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

        <Card>
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
            <div className="space-y-1.5">
              <CardTitle>Athletic</CardTitle>
              <CardDescription>
                SwimCloud import — prospect chances from team average power index. Page-only academics also appear under
                Academic when College Scorecard has not filled those slots; remaining SwimCloud page fields stay here as
                a snapshot.
              </CardDescription>
            </div>
            {swimcloudUrlForButton ? (
              <Button variant="outline" size="sm" className="shrink-0 gap-1.5" asChild>
                <a href={swimcloudUrlForButton} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="size-3.5" aria-hidden />
                  SwimCloud
                </a>
              </Button>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-2">
            {!swim ? (
              <p className="text-sm text-muted-foreground">
                No swim data yet. Swim and athletic data is added manually via{" "}
                <Link href="/import">Import</Link> (SwimCloud JSON under{" "}
                <code className="rounded bg-muted px-1 text-xs">data/imports/</code>).
                This data is not populated by the enrichment job.
              </p>
            ) : swim.notInSwimCloud ? (
              <p className="text-sm text-muted-foreground">
                No SwimCloud profile found.
              </p>
            ) : (
              <>
                {swimLinkedNoFit ? (
                  <p className="text-sm text-muted-foreground">
                    Linked SwimCloud team, but fit metrics were not captured yet. Re-run a headed fetch locally (
                    <code className="rounded bg-muted px-1 text-xs">npm run swimcloud:fetch:headed</code>) and{" "}
                    <code className="rounded bg-muted px-1 text-xs">npm run import:run</code>.
                  </p>
                ) : null}
                <dl className="space-y-3">
                <div className="grid gap-1 sm:grid-cols-3">
                  <dt className="text-sm text-muted-foreground">SwimCloud team ID</dt>
                  <dd className="text-sm sm:col-span-2">
                    {swimTeamIdForDisplay != null ? String(swimTeamIdForDisplay) : "—"}
                  </dd>
                </div>
                <div className="grid gap-1 sm:grid-cols-3">
                  <dt className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <span>Swim Odds</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex rounded-full text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                          aria-label="How Swim Odds are determined"
                        >
                          <Info className="size-4 shrink-0" aria-hidden />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-sm text-left whitespace-pre-line">
                        {prospectChancesExplainer()}
                      </TooltipContent>
                    </Tooltip>
                  </dt>
                  <dd className="text-sm sm:col-span-2">
                    {prospectChancesFromAthleticTier(athleticTierForProspect) ? (
                      <ProspectChancesBadge athleticTier={athleticTierForProspect} />
                    ) : (
                      "—"
                    )}
                  </dd>
                </div>
              <div className="grid gap-1 sm:grid-cols-3">
                <dt className="text-sm text-muted-foreground">Team Power Index (Avg)</dt>
                <dd className="text-sm sm:col-span-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span>{teamPowerIndexAvgFinite != null ? String(teamPowerIndexAvgFinite) : "—"}</span>
                    {userPowerIndex != null && teamPowerIndexAvgFinite != null ? (
                      <PowerIndexCompareBadge user={userPowerIndex} team={teamPowerIndexAvgFinite} />
                    ) : null}
                  </div>
                </dd>
              </div>
              <div className="grid gap-1 sm:grid-cols-3">
                <dt className="text-sm text-muted-foreground">Abigail Roster Rank</dt>
                <dd className="text-sm sm:col-span-2">
                  {swim.abigailRank != null
                    ? `${swim.abigailRank}${swim.athleteEvent ? ` (based on ${swim.athleteEvent})` : ""}`
                    : "—"}
                </dd>
              </div>
              <div className="grid gap-1 sm:grid-cols-3">
                <dt className="text-sm text-muted-foreground">NCAA Division</dt>
                <dd className="text-sm sm:col-span-2">{String(swim.ncaaDivision ?? "—")}</dd>
              </div>
              <div className="grid gap-1 sm:grid-cols-3">
                <dt className="text-sm text-muted-foreground">Roster Size</dt>
                <dd className="text-sm sm:col-span-2">{swim.rosterSize != null ? String(swim.rosterSize) : "—"}</dd>
              </div>
              <div className="grid gap-1 sm:grid-cols-3">
                <dt className="text-sm text-muted-foreground">Seniors graduating</dt>
                <dd className="text-sm sm:col-span-2">{swim.seniorsGraduating != null ? String(swim.seniorsGraduating) : "—"}</dd>
              </div>
              <div className="grid gap-1 sm:grid-cols-3">
                <dt className="text-sm text-muted-foreground">Team rank (page)</dt>
                <dd className="text-sm sm:col-span-2">{String(swim.teamRankDisplay ?? "—")}</dd>
              </div>
              <div className="grid gap-1 sm:grid-cols-3">
                <dt className="text-sm text-muted-foreground">Conference</dt>
                <dd className="text-sm sm:col-span-2">{String(swim.conference ?? "—")}</dd>
              </div>
            </dl>
              </>
          )}
        </CardContent>
        {swim && typeof swim === "object" && !swim.notInSwimCloud ? (
          <CardFooter>
            <p className="text-xs text-muted-foreground">Data collected {fmtIsoDate(swim.dataCollectedAt)}</p>
          </CardFooter>
        ) : null}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Academic</CardTitle>
          <CardDescription>IR / pre-law and Scorecard metrics — Scorecard overwrites shared fields when imported after SwimCloud.</CardDescription>
        </CardHeader>
        <CardContent>
          {!academic ? (
            <EmptyBlurb />
          ) : (
            <dl className="space-y-3">
              <div className="grid gap-1 sm:grid-cols-3">
                <dt className="text-sm text-muted-foreground">Program label</dt>
                <dd className="text-sm sm:col-span-2">{String(academic.programLabel ?? "—")}</dd>
              </div>
              <div className="grid gap-1 sm:grid-cols-3">
                <dt className="text-sm text-muted-foreground">Program type</dt>
                <dd className="text-sm sm:col-span-2">{String(academic.programType ?? "—")}</dd>
              </div>
              <div className="grid gap-1 sm:grid-cols-3">
                <dt className="text-sm text-muted-foreground">Flagship / school</dt>
                <dd className="text-sm sm:col-span-2">{String(academic.flagshipSchool ?? "—")}</dd>
              </div>
              <div className="grid gap-1 sm:grid-cols-3">
                <dt className="text-sm text-muted-foreground">Program notes</dt>
                <dd className="text-sm sm:col-span-2 whitespace-pre-wrap">{String(academic.programNotes ?? "—")}</dd>
              </div>
              <div className="grid gap-1 sm:grid-cols-3">
                <dt className="text-sm text-muted-foreground">Study abroad</dt>
                <dd className="text-sm sm:col-span-2">{String(academic.studyAbroadLevel ?? "—")}</dd>
              </div>
              <div className="grid gap-1 sm:grid-cols-3">
                <dt className="text-sm text-muted-foreground">Study abroad notes</dt>
                <dd className="text-sm sm:col-span-2 whitespace-pre-wrap">{String(academic.studyAbroadNotes ?? "—")}</dd>
              </div>
              <div className="grid gap-1 sm:grid-cols-3">
                <dt className="text-sm text-muted-foreground">Acceptance rate</dt>
                <dd className="text-sm sm:col-span-2">
                  {academic.acceptanceRate != null ? `${academic.acceptanceRate}%` : "—"}
                </dd>
              </div>
              <div className="grid gap-1 sm:grid-cols-3">
                <dt className="text-sm text-muted-foreground">SAT Composite mid-50%</dt>
                <dd className="text-sm sm:col-span-2">
                  {academic.satMid50Low != null && academic.satMid50High != null
                    ? `${academic.satMid50Low}–${academic.satMid50High}`
                    : "—"}
                </dd>
              </div>
              <div className="grid gap-1 sm:grid-cols-3">
                <dt className="text-sm text-muted-foreground">SAT Math mid-50%</dt>
                <dd className="text-sm sm:col-span-2">
                  {academic.satMathMid50Low != null && academic.satMathMid50High != null
                    ? `${academic.satMathMid50Low}–${academic.satMathMid50High}`
                    : "—"}
                </dd>
              </div>
              <div className="grid gap-1 sm:grid-cols-3">
                <dt className="text-sm text-muted-foreground">SAT R&W mid-50%</dt>
                <dd className="text-sm sm:col-span-2">
                  {academic.satEBRWMid50Low != null && academic.satEBRWMid50High != null
                    ? `${academic.satEBRWMid50Low}–${academic.satEBRWMid50High}`
                    : "—"}
                </dd>
              </div>
              <div className="grid gap-1 sm:grid-cols-3">
                <dt className="text-sm text-muted-foreground">Setting</dt>
                <dd className="text-sm sm:col-span-2">{String(academic.setting ?? "—")}</dd>
              </div>
              <div className="grid gap-1 sm:grid-cols-3">
                <dt className="text-sm text-muted-foreground">Retention (1st year)</dt>
                <dd className="text-sm sm:col-span-2">
                  {academic.retentionRate != null ? `${academic.retentionRate}%` : "—"}
                </dd>
              </div>
              <div className="grid gap-1 sm:grid-cols-3">
                <dt className="text-sm text-muted-foreground">Grad rate (4 yr)</dt>
                <dd className="text-sm sm:col-span-2">
                  {academic.gradRate4Year != null ? `${academic.gradRate4Year}%` : "—"}
                </dd>
              </div>
              <div className="grid gap-1 sm:grid-cols-3">
                <dt className="text-sm text-muted-foreground">Student : faculty</dt>
                <dd className="text-sm sm:col-span-2">
                  {academic.studentFacultyRatio != null ? String(academic.studentFacultyRatio) : "—"}
                </dd>
              </div>
              <div className="grid gap-1 sm:grid-cols-3">
                <dt className="text-sm text-muted-foreground">T14 placements</dt>
                <dd className="text-sm sm:col-span-2 whitespace-pre-wrap">{String(academic.t14Placements ?? "—")}</dd>
              </div>
              <div className="grid gap-1 sm:grid-cols-3">
                <dt className="text-sm text-muted-foreground">Pre-law quality</dt>
                <dd className="text-sm sm:col-span-2 whitespace-pre-wrap">{String(academic.preLawQuality ?? "—")}</dd>
              </div>
              <div className="grid gap-1 sm:grid-cols-3">
                <dt className="text-sm text-muted-foreground">Feeder reputation</dt>
                <dd className="text-sm sm:col-span-2 whitespace-pre-wrap">{String(academic.feederReputation ?? "—")}</dd>
              </div>
              <div className="grid gap-1 sm:grid-cols-3">
                <dt className="text-sm text-muted-foreground">Academic data collected</dt>
                <dd className="text-sm sm:col-span-2">{fmtIsoDate(academic.dataCollectedAt)}</dd>
              </div>
            </dl>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Financial</CardTitle>
          <CardDescription>
            Published cost-of-attendance breakdown and athletic aid availability from College Scorecard / import data.
          </CardDescription>
          <CardDescription>
            Scorecard figures are typically 1–2 years behind current rates. COA increases ~5–6% annually. At household
            incomes above $200k, need-based aid is unlikely at most private institutions — the published COA is the more
            relevant starting point.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!financialRecord ? (
            <p className="text-sm text-muted-foreground">
              No financial row yet. Published costs appear after a College Scorecard or file import.
            </p>
          ) : null}

          <div className="space-y-3">
            <p className="text-sm font-medium">College Scorecard Cost of Attendance</p>
            <dl className="space-y-3">
              <div className="grid gap-1 sm:grid-cols-3">
                <dt className="text-sm text-muted-foreground">Average Annual Cost</dt>
                <dd className="text-sm sm:col-span-2">{formatCurrencyUSD(scorecardAvgAnnualCost ?? undefined)}</dd>
              </div>
              <div className="grid gap-1 sm:grid-cols-3">
                <dt className="text-sm text-muted-foreground">Total COA</dt>
                <dd className="text-sm sm:col-span-2">{formatCurrencyUSD(publishedCOA ?? undefined)}</dd>
              </div>
              <div className="grid gap-1 sm:grid-cols-3">
                <dt className="text-sm text-muted-foreground">Tuition</dt>
                <dd className="text-sm sm:col-span-2">
                  {financialRecord && typeof financialRecord.tuition === "number"
                    ? formatCurrencyUSD(financialRecord.tuition)
                    : "—"}
                </dd>
              </div>
              <div className="grid gap-1 sm:grid-cols-3">
                <dt className="text-sm text-muted-foreground">Room & Board</dt>
                <dd className="text-sm sm:col-span-2">
                  {financialRecord && typeof financialRecord.roomAndBoard === "number"
                    ? formatCurrencyUSD(financialRecord.roomAndBoard)
                    : "—"}
                </dd>
              </div>
              <div className="grid gap-1 sm:grid-cols-3">
                <dt className="text-sm text-muted-foreground">Fees & Other</dt>
                <dd className="text-sm sm:col-span-2">
                  {financialRecord && typeof financialRecord.feesAndOther === "number"
                    ? formatCurrencyUSD(financialRecord.feesAndOther)
                    : "—"}
                </dd>
              </div>
              <Separator className="my-1" />
              <div className="grid gap-1 sm:grid-cols-3">
                <dt className="text-sm text-muted-foreground">Avg. net cost (aid recipients, SwimCloud)</dt>
                <dd className="text-sm sm:col-span-2">{formatCurrencyUSD(swimcloudAvgAnnualCost)}</dd>
              </div>
              <div className="grid gap-1 sm:grid-cols-3">
                <dt className="text-sm text-muted-foreground">Athletic Aid Available</dt>
                <dd className="text-sm sm:col-span-2">
                  {athleticAvailEffective === true ? (
                    <Badge className="border-amber-600/40 bg-amber-600/15 text-amber-900 hover:bg-amber-600/20 dark:text-amber-100">
                      Yes
                    </Badge>
                  ) : athleticAvailEffective === false ? (
                    <Badge variant="destructive">No</Badge>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
            </dl>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Email domains</CardTitle>
          <CardDescription>
            Known email domains for this school. Emails from these domains are automatically linked in the Mail inbox.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {emailDomains.length > 0 && (
            <ul className="space-y-2">
              {emailDomains.map((d) => (
                <li key={d.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                  <span className="text-sm font-mono">@{d.domain}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-destructive hover:text-destructive"
                    onClick={() => setEmailDomainRemoveTarget({ id: d.id, domain: d.domain })}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <Input
              placeholder="e.g. stanford.edu"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void addEmailDomain();
                }
              }}
              className="max-w-xs"
            />
            <Button
              variant="secondary"
              size="sm"
              disabled={domainSaving || !newDomain.trim()}
              onClick={() => void addEmailDomain()}
            >
              {domainSaving ? "Adding…" : "Add domain"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle>Coach contacts</CardTitle>
            <CardDescription>Inbound / outbound log (V1 fields only).</CardDescription>
          </div>
          <Button size="sm" onClick={openNewContact}>
            Add contact
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {school.coachContacts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No contacts yet.</p>
          ) : (
            <>
              <Separator />
              <ul className="space-y-4">
                {school.coachContacts.map((c) => (
                  <li key={c.id} className="rounded-lg border p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-sm font-medium">
                          {c.direction} · {c.type}
                        </p>
                        <p className="text-xs text-muted-foreground">{new Date(c.date).toLocaleString()}</p>
                        <p className="mt-2 text-sm">{c.summary}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => openEditContact(c)}>
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={saving === `del-${c.id}`}
                          onClick={() => deleteContact(c)}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
          <CardDescription>Private notes (not sent to AI summary).</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={5} className="resize-y" />
        </CardContent>
        <CardFooter>
          <Button
            disabled={saving === "notes"}
            onClick={() => patchSchool({ notes: notes === "" ? null : notes }, "notes", "Notes saved.")}
          >
            {saving === "notes" ? "Saving…" : "Save notes"}
          </Button>
        </CardFooter>
      </Card>

      <Dialog
        open={emailDomainRemoveTarget !== null}
        onOpenChange={(open) => {
          if (!open && !domainRemoving) setEmailDomainRemoveTarget(null);
        }}
      >
        <DialogContent
          onPointerDownOutside={(e) => {
            if (domainRemoving) e.preventDefault();
          }}
          onEscapeKeyDown={(e) => {
            if (domainRemoving) e.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle>Remove this email domain?</DialogTitle>
            <DialogDescription>
              Mail will stop linking messages from{" "}
              <span className="font-mono text-foreground">@{emailDomainRemoveTarget?.domain}</span> to this school until
              you add the domain again.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={domainRemoving}
              onClick={() => setEmailDomainRemoveTarget(null)}
            >
              Cancel
            </Button>
            <Button variant="destructive" disabled={domainRemoving} onClick={() => void confirmRemoveEmailDomain()}>
              {domainRemoving ? "Removing…" : "Remove domain"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={contactDialogOpen} onOpenChange={setContactDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingContact ? "Edit contact" : "Add contact"}</DialogTitle>
            <DialogDescription>Date, direction, type, and summary.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="contact-date">Date & time</Label>
              <Input
                id="contact-date"
                type="datetime-local"
                value={contactDate}
                onChange={(e) => setContactDate(e.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Direction</Label>
                <Select value={contactDirection} onValueChange={(v) => setContactDirection(v as (typeof COACH_DIRECTIONS)[number])}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COACH_DIRECTIONS.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={contactType} onValueChange={(v) => setContactType(v as (typeof COACH_TYPES)[number])}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COACH_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-summary">Summary</Label>
              <Textarea id="contact-summary" value={contactSummary} onChange={(e) => setContactSummary(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setContactDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void saveContact()} disabled={saving === "contact"}>
              {saving === "contact" ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectDialogOpen} onOpenChange={(open) => !open && setRejectDialogOpen(false)}>
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
            <Button type="button" variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!rejectReason || saving === "status"}
              onClick={() => {
                setStatus("Rejected");
                setRejectDialogOpen(false);
                void patchSchool(
                  { status: "Rejected", rejectionReason: rejectReason },
                  "status",
                  "Status updated.",
                );
              }}
            >
              {saving === "status" ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </TooltipProvider>
  );
}
