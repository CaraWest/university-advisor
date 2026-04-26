"use client";

import * as React from "react";
import Link from "next/link";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";

import type { SchoolMapRow } from "@/lib/types/school-map";
import { prospectChancesFromAthleticTier, ROUND_ROCK_LAT, ROUND_ROCK_LON } from "@/lib/derived";
import { schoolStatusBadgeClassName, schoolStatusLabel } from "@/lib/school-status-ui";
import { SCHOOL_STATUSES, type SchoolStatus } from "@/lib/validation/school";
import { ProspectChancesBadge } from "@/components/schools/prospect-chances-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import "leaflet/dist/leaflet.css";

const ACTIVITY_FILTERS_STORAGE_KEY = "schools-map-activity-filters-v1";

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

// Default marker assets break under bundlers; use CDN (Leaflet FAQ pattern).
// @ts-expect-error — Leaflet replaces _getIconUrl at runtime
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  React.useEffect(() => {
    if (points.length === 0) {
      map.setView([ROUND_ROCK_LAT, ROUND_ROCK_LON], 4);
      return;
    }
    if (points.length === 1) {
      map.setView(points[0], 8);
      return;
    }
    const bounds = L.latLngBounds(points.map(([lat, lng]) => L.latLng(lat, lng)));
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 10 });
  }, [map, points]);
  return null;
}

export function SchoolsMapClient() {
  const [rows, setRows] = React.useState<SchoolMapRow[] | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [activityFilters, setActivityFilters] = React.useState<ActivityFilters>(() => readActivityFilters());

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(ACTIVITY_FILTERS_STORAGE_KEY, JSON.stringify(activityFilters));
  }, [activityFilters]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/schools/map");
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        const data: unknown = await res.json();
        if (!Array.isArray(data)) throw new Error("Invalid response");
        if (!cancelled) {
          setRows(data as SchoolMapRow[]);
          setLoadError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setRows(null);
          setLoadError(e instanceof Error ? e.message : "Failed to load map data");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = React.useMemo(() => {
    if (!rows) return [];
    let next = rows.filter((r) => r.status !== "Rejected");
    if (activityFilters.favorite) next = next.filter((r) => r.abigailFavorite);
    if (activityFilters.email) next = next.filter((r) => r.hasEmails);
    if (activityFilters.swimcloudInterest) next = next.filter((r) => r.interested);
    if (activityFilters.phoneCall) next = next.filter((r) => r.phoneCall);
    if (activityFilters.campusVisit) next = next.filter((r) => r.campusVisit);
    return next;
  }, [rows, activityFilters]);

  const withCoords = React.useMemo(
    () =>
      filtered.filter(
        (r): r is SchoolMapRow & { latitude: number; longitude: number } =>
          r.latitude != null && r.longitude != null,
      ),
    [filtered],
  );

  const missingCoordsInFilter = React.useMemo(
    () => filtered.filter((r) => r.latitude == null || r.longitude == null),
    [filtered],
  );

  const positions = React.useMemo(() => withCoords.map((r) => [r.latitude, r.longitude] as [number, number]), [withCoords]);

  if (loadError) {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/5 p-4 text-sm text-destructive">{loadError}</div>
    );
  }

  if (!rows) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading map">
        <Skeleton className="h-4 w-full max-w-xl" />
        <Skeleton className="h-[min(70vh,560px)] w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex w-full min-w-0 flex-wrap items-center gap-2">
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

      <p className="text-sm text-muted-foreground">
        Showing <strong className="text-foreground">{withCoords.length}</strong> schools on the map
        {missingCoordsInFilter.length > 0 ? (
          <>
            ; <strong className="text-foreground">{missingCoordsInFilter.length}</strong> have no coordinates
            (import College Scorecard for lat/lng)
          </>
        ) : null}
        .
      </p>

      <div className="relative z-0 h-[min(70vh,560px)] w-full overflow-hidden rounded-lg border">
        <MapContainer
          center={[ROUND_ROCK_LAT, ROUND_ROCK_LON]}
          zoom={4}
          className="h-full w-full"
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitBounds points={positions} />
          {withCoords.map((r) => (
            <Marker key={r.id} position={[r.latitude, r.longitude]}>
              <Popup>
                <div className="min-w-[200px] space-y-1 text-sm">
                  <p className="font-medium leading-tight">
                    <Link href={`/schools/${r.id}`} className="text-primary hover:underline">
                      {r.name}
                    </Link>
                  </p>
                  <p className="text-muted-foreground">
                    {[r.city, r.state].filter(Boolean).join(", ") || r.state}
                  </p>
                  <p className="flex flex-wrap items-center gap-1.5">
                    <span className="text-muted-foreground">Status:</span>
                    {(SCHOOL_STATUSES as readonly string[]).includes(r.status) ? (
                      <span className={schoolStatusBadgeClassName(r.status as SchoolStatus)}>
                        {schoolStatusLabel(r.status as SchoolStatus)}
                      </span>
                    ) : (
                      r.status
                    )}
                  </p>
                  <p className="flex flex-wrap items-center gap-1.5">
                    <span className="text-muted-foreground">Swim Odds:</span>
                    {prospectChancesFromAthleticTier(r.athleticTier) ? (
                      <ProspectChancesBadge athleticTier={r.athleticTier} />
                    ) : (
                      "—"
                    )}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Distance from Round Rock:</span>{" "}
                    {r.distanceFromHome != null ? `${Number(r.distanceFromHome).toFixed(1)} mi` : "—"}
                  </p>
                  <Button variant="outline" size="sm" className="mt-2 w-full" asChild>
                    <Link href={`/schools/${r.id}`}>Open detail</Link>
                  </Button>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      <p className="text-xs text-muted-foreground">
        Map tiles © OpenStreetMap contributors — no API key required for local / personal use. Coordinates and distance
        come from your SQLite database (typically after a Scorecard import).
      </p>
    </div>
  );
}
