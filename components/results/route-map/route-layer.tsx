"use client";

import { Polyline } from "react-leaflet";
import type { LatLngExpression } from "leaflet";

export function RouteLayer({
  color,
  coordinates,
  dimmed,
  onSelect,
}: {
  color: string;
  coordinates: LatLngExpression[];
  dimmed: boolean;
  onSelect: () => void;
}) {
  if (coordinates.length < 2) {
    return null;
  }

  return (
    <Polyline
      eventHandlers={{ click: onSelect }}
      pathOptions={{
        color,
        lineCap: "round",
        lineJoin: "round",
        opacity: dimmed ? 0.28 : 0.88,
        weight: dimmed ? 4 : 6,
      }}
      positions={coordinates}
    />
  );
}
