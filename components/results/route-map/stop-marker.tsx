"use client";

import { useMemo } from "react";
import L, { type LatLngExpression } from "leaflet";
import { Marker, Popup } from "react-leaflet";

import type { TimeWindow } from "@/lib/types";

export function DepotMarker({ position }: { position: LatLngExpression }) {
  const icon = useMemo(
    () =>
      L.divIcon({
        className: "",
        html: markerHtml({
          background: "#1a1c1d",
          borderRadius: "4px",
          label: "D",
        }),
        iconAnchor: [12, 12],
        iconSize: [24, 24],
      }),
    [],
  );

  return (
    <Marker icon={icon} position={position}>
      <Popup>
        <strong>Depot</strong>
      </Popup>
    </Marker>
  );
}

export function StopMarker({
  address,
  color,
  demandText,
  eta,
  name,
  position,
  sequence,
  stopRole,
  timeWindow,
}: {
  address: string;
  color: string;
  demandText: string;
  eta?: string;
  name: string;
  position: LatLngExpression;
  sequence: number;
  stopRole: string;
  timeWindow?: TimeWindow;
}) {
  const icon = useMemo(
    () =>
      L.divIcon({
        className: "",
        html: markerHtml({
          background: color,
          borderRadius: "9999px",
          label: String(sequence),
        }),
        iconAnchor: [12, 12],
        iconSize: [24, 24],
      }),
    [color, sequence],
  );

  return (
    <Marker icon={icon} position={position}>
      <Popup>
        <div className="min-w-36 text-sm">
          <p className="font-semibold text-foreground">
            {stopRole} {sequence}
          </p>
          <p className="font-medium text-foreground">{name}</p>
          <p className="mt-1 text-muted-foreground">{address}</p>
          {eta ? <p className="mt-2">ETA: {eta}</p> : null}
          {demandText !== "-" ? <p>{demandText}</p> : null}
          {timeWindow ? (
            <p>
              Window: {timeWindow.start}-{timeWindow.end}
            </p>
          ) : null}
        </div>
      </Popup>
    </Marker>
  );
}

function markerHtml({
  background,
  borderRadius,
  label,
}: {
  background: string;
  borderRadius: string;
  label: string;
}) {
  return `<div style="
    align-items:center;
    background:${background};
    border:2px solid #ffffff;
    border-radius:${borderRadius};
    box-shadow:0 2px 8px rgba(0,0,0,0.18);
    color:#ffffff;
    display:flex;
    font:700 11px Arial,sans-serif;
    height:24px;
    justify-content:center;
    width:24px;
  ">${label}</div>`;
}
