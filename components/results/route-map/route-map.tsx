"use client";

import { useEffect, useMemo } from "react";
import L, { type LatLngExpression } from "leaflet";
import { MapContainer, TileLayer, useMap } from "react-leaflet";

import { RouteLayer } from "@/components/results/route-map/route-layer";
import { DepotMarker, StopMarker } from "@/components/results/route-map/stop-marker";
import { formatStopDemands, getCapacityDimensions } from "@/lib/capacity";
import { getVehicleRouteColor } from "@/lib/map/route-styles";
import { defaultTileLayer } from "@/lib/map/tiles";
import {
  routeLocationById,
  routeStopActionLabel,
  type FrontendRouteLocation,
} from "@/lib/routing-locations";
import type {
  GeoLocation,
  RouteCoordinate,
  RoutingResult,
  VehicleRouteGeometry,
  RoutingProblem,
} from "@/lib/types";
import { cn } from "@/lib/utils";

export function RouteMap({
  onSelectedVehicleChange,
  problem,
  result,
  routeGeometries,
  selectedVehicleId,
}: {
  onSelectedVehicleChange: (vehicleId: string | null) => void;
  problem: RoutingProblem;
  result: RoutingResult;
  routeGeometries: VehicleRouteGeometry[];
  selectedVehicleId: string | null;
}) {
  const mapRoutes = useMemo(
    () => buildMapRoutes({ problem, result, routeGeometries }),
    [problem, result, routeGeometries],
  );
  const visibleRoutes = selectedVehicleId
    ? mapRoutes.filter((route) => route.vehicleId === selectedVehicleId)
    : mapRoutes;
  const visiblePositions = [
    ...visibleRoutes.flatMap((route) => route.geometryPositions),
    ...visibleRoutes.flatMap((route) =>
      route.stops.map((stop) => stop.position),
    ),
  ];
  const initialCenter = getInitialCenter(
    mapRoutes,
    toLatLng(problem.depot),
  );

  return (
    <div className="relative h-full min-h-[420px] w-full">
      <MapContainer
        center={initialCenter}
        className="h-full min-h-[420px] w-full"
        scrollWheelZoom
        zoom={13}
      >
        <TileLayer
          attribution={defaultTileLayer.attribution}
          url={defaultTileLayer.url}
        />
        <FitMapBounds positions={visiblePositions} />
        {mapRoutes.map((route) => {
          const dimmed =
            Boolean(selectedVehicleId) && selectedVehicleId !== route.vehicleId;

          return (
            <RouteLayer
              color={route.color}
              coordinates={route.geometryPositions}
              dimmed={dimmed}
              key={route.vehicleId}
              onSelect={() => onSelectedVehicleChange(route.vehicleId)}
            />
          );
        })}
        {problem.depot ? (
          <DepotMarker position={toLatLng(problem.depot) ?? initialCenter} />
        ) : null}
        {visibleRoutes.flatMap((route) =>
          route.stops.map((stop) => (
            <StopMarker
              address={stop.address}
              color={route.color}
              demandText={stop.demandText}
              eta={stop.eta}
              key={`${route.vehicleId}-${stop.stopId}`}
              name={stop.name}
              position={stop.position}
              sequence={stop.sequence}
              stopRole={stop.stopRole}
              timeWindow={stop.timeWindow}
            />
          )),
        )}
      </MapContainer>

      <div className="absolute left-4 top-4 z-[500] flex max-w-[calc(100%-2rem)] flex-wrap gap-2 rounded-lg border border-border bg-surface/95 p-2 shadow-[0_4px_12px_rgba(0,0,0,0.08)] backdrop-blur-sm">
        <button
          className={selectorClassName(selectedVehicleId === null)}
          onClick={() => onSelectedVehicleChange(null)}
          type="button"
        >
          All routes
        </button>
        {mapRoutes.map((route) => (
          <button
            className={selectorClassName(selectedVehicleId === route.vehicleId)}
            key={route.vehicleId}
            onClick={() => onSelectedVehicleChange(route.vehicleId)}
            style={{
              borderColor:
                selectedVehicleId === route.vehicleId ? route.color : undefined,
              color:
                selectedVehicleId === route.vehicleId ? route.color : undefined,
            }}
            type="button"
          >
            {route.vehicleName}
          </button>
        ))}
      </div>

      <div className="absolute bottom-4 left-4 z-[500] flex flex-col gap-2 rounded-lg border border-border bg-surface/95 p-3 shadow-[0_4px_12px_rgba(0,0,0,0.08)] backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <span className="flex h-3 w-3 items-center justify-center rounded-sm bg-foreground" />
          <span className="font-display text-xs font-semibold text-foreground">
            Depot
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex h-3 w-3 items-center justify-center rounded-full bg-primary-accent text-[8px] font-bold text-white">
            1
          </span>
          <span className="font-display text-xs font-semibold text-muted-foreground">
            Stop
          </span>
        </div>
      </div>
    </div>
  );
}

type MapRoute = {
  vehicleId: string;
  vehicleName: string;
  color: string;
  geometryPositions: LatLngExpression[];
  stops: MapStop[];
};

type MapStop = {
  stopId: string;
  name: string;
  address: string;
  demandText: string;
  eta?: string;
  position: LatLngExpression;
  sequence: number;
  stopRole: string;
  timeWindow?: FrontendRouteLocation["timeWindow"];
};

function FitMapBounds({ positions }: { positions: LatLngExpression[] }) {
  const map = useMap();
  const boundsKey = JSON.stringify(positions);

  useEffect(() => {
    if (positions.length === 0) {
      return;
    }

    if (positions.length === 1) {
      map.setView(positions[0], 14);
      return;
    }

    const bounds = L.latLngBounds(positions);
    map.fitBounds(bounds, {
      maxZoom: 15,
      padding: [36, 36],
    });
  }, [boundsKey, map, positions]);

  return null;
}

function buildMapRoutes({
  problem,
  result,
  routeGeometries,
}: {
  problem: RoutingProblem;
  result: RoutingResult;
  routeGeometries: VehicleRouteGeometry[];
}) {
  const stopById = routeLocationById(problem);
  const capacityDimensions = getCapacityDimensions(problem);
  const vehicleNameById = new Map(
    problem.vehicles.map((vehicle) => [vehicle.id, vehicle.name]),
  );
  const geometryByVehicleId = new Map(
    routeGeometries.map((routeGeometry) => [
      routeGeometry.vehicleId,
      routeGeometry.geometry,
    ]),
  );

  return result.routes
    .map((route): MapRoute | null => {
      const geometry = geometryByVehicleId.get(route.vehicleId);

      if (!geometry) {
        return null;
      }

      const color = getVehicleRouteColor(route.vehicleId);
      const stops = route.stops
        .map((routeStop): MapStop | null => {
          const stop = stopById.get(routeStop.stopId);
          const position = stop ? toLatLng(stop) : null;

          if (!stop || !position) {
            return null;
          }

          return {
            stopId: stop.id,
            name: stop.name,
            address: stop.address,
            demandText: formatStopDemands(stop, capacityDimensions),
            eta: routeStop.eta,
            position,
            sequence: routeStop.order,
            stopRole: routeStopActionLabel(routeStop.stopRole ?? stop.role),
            timeWindow: stop.timeWindow,
          };
        })
        .filter((stop): stop is MapStop => stop !== null);

      return {
        vehicleId: route.vehicleId,
        vehicleName: vehicleNameById.get(route.vehicleId) ?? route.vehicleId,
        color,
        geometryPositions: geometry.coordinates.map(toLatLngFromCoordinate),
        stops,
      };
    })
    .filter((route): route is MapRoute => route !== null);
}

function getInitialCenter(
  routes: MapRoute[],
  depotPosition: LatLngExpression | null,
): LatLngExpression {
  const firstRouteCoordinate = routes[0]?.geometryPositions[0];

  return firstRouteCoordinate ?? depotPosition ?? [0, 0];
}

function toLatLng(
  location?: GeoLocation | FrontendRouteLocation,
): LatLngExpression | null {
  if (
    typeof location?.latitude !== "number" ||
    typeof location.longitude !== "number"
  ) {
    return null;
  }

  return [location.latitude, location.longitude];
}

function toLatLngFromCoordinate(coordinate: RouteCoordinate): LatLngExpression {
  return [coordinate.latitude, coordinate.longitude];
}

function selectorClassName(selected: boolean) {
  return cn(
    "rounded-md border px-3 py-1.5 font-display text-xs font-semibold transition-colors",
    selected
      ? "border-primary-accent bg-card text-primary"
      : "border-border bg-card text-muted-foreground hover:text-foreground",
  );
}
