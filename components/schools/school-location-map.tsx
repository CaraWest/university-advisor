"use client";

import * as React from "react";
import L from "leaflet";
import { MapContainer, Marker, TileLayer } from "react-leaflet";

import "leaflet/dist/leaflet.css";

// @ts-expect-error — Leaflet replaces _getIconUrl at runtime
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-shadow.png",
});

type SchoolLocationMapProps = {
  latitude: number;
  longitude: number;
};

export function SchoolLocationMap({ latitude, longitude }: SchoolLocationMapProps) {
  return (
    <div className="relative z-0 aspect-[4/3] w-full overflow-hidden rounded-md border">
      <MapContainer
        center={[39.0, -98.0]}
        zoom={3}
        className="h-full w-full"
        scrollWheelZoom
        zoomControl
        dragging
        attributionControl={false}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Marker position={[latitude, longitude]} />
      </MapContainer>
    </div>
  );
}
