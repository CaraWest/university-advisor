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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

import "leaflet/dist/leaflet.css";

// Default marker assets break under bundlers; use CDN (Leaflet FAQ pattern).
// @ts-expect-error — Leaflet replaces _getIconUrl at runtime
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function rowMatchesSearch(row: SchoolMapRow, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const hay = [row.name, row.state, row.city, row.institutionType, row.status]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(needle);
}

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
  const [search, setSearch] = React.useState("");

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
    return rows.filter((r) => rowMatchesSearch(r, search));
  }, [rows, search]);

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
        <div className="flex flex-col gap-3 lg:flex-row">
          <Skeleton className="h-10 w-full max-w-md" />
          <Skeleton className="h-5 w-56" />
        </div>
        <Skeleton className="h-4 w-full max-w-xl" />
        <Skeleton className="h-[min(70vh,560px)] w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2 flex-1 max-w-md">
          <Label htmlFor="map-search">Filter</Label>
          <Input
            id="map-search"
            placeholder="Name, state, city, type, or status…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Showing <strong className="text-foreground">{withCoords.length}</strong> schools on the map
        {missingCoordsInFilter.length > 0 ? (
          <>
            ; <strong className="text-foreground">{missingCoordsInFilter.length}</strong> in this filter have no coordinates
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
