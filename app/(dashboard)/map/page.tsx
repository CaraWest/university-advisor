import dynamic from "next/dynamic";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Map",
};

const SchoolsMapClient = dynamic(
  () => import("@/components/map/schools-map-client").then((m) => ({ default: m.SchoolsMapClient })),
  {
    ssr: false,
    loading: () => <p className="text-sm text-muted-foreground">Loading map…</p>,
  },
);

export default function MapPage() {
  return (
    <div className="mx-auto w-full min-w-0 max-w-7xl py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">School map</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Leaflet + OpenStreetMap. Same text filter as the schools list. Only schools with latitude and longitude get markers.
        </p>
      </div>
      <SchoolsMapClient />
    </div>
  );
}
