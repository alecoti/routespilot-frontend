"use client";

import { AlertCircle, ArrowDown, Check, RotateCcw, Warehouse } from "lucide-react";

import {
  formatRouteCapacityUsage,
  getCapacityDimensions,
  maxCapacityUsagePercent,
} from "@/lib/capacity";
import { formatDuration, formatMoneyMinor } from "@/lib/formatters";
import { formatLocationAddress } from "@/lib/locations";
import { getVehicleRouteColor } from "@/lib/map/route-styles";
import {
  routeLocationById,
  routeStopActionLabel,
} from "@/lib/routing-locations";
import type { Vehicle, VehicleRouteResult } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useOptimizationStore } from "@/providers/optimization-provider";

export function VehicleAssignments({
  onSelectedVehicleChange,
  selectedVehicleId,
}: {
  onSelectedVehicleChange: (vehicleId: string | null) => void;
  selectedVehicleId: string | null;
}) {
  const problem = useOptimizationStore((state) => state.problem);
  const result = useOptimizationStore((state) => state.result);
  const stopById = routeLocationById(problem);

  if (!result) {
    return null;
  }

  if (!result.feasible) {
    return (
      <aside className="scrollbar-soft flex min-h-0 flex-col gap-4 overflow-y-auto lg:w-[35%]">
        <h3 className="font-display text-lg font-medium text-foreground">
          Vehicle assignments
        </h3>
        <article className="rounded-xl border border-destructive/20 bg-card p-4">
          <p className="flex items-center gap-2 font-display text-sm font-semibold text-destructive">
            <AlertCircle aria-hidden className="h-4 w-4" />
            No feasible route found
          </p>
          <div className="mt-3 flex flex-col gap-2 text-sm leading-6 text-muted-foreground">
            {(result.warnings.length > 0
              ? result.warnings
              : ["Adjust vehicles, capacities, stops, or time windows."]
            ).map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        </article>
      </aside>
    );
  }

  const vehicleById = new Map(problem.vehicles.map((vehicle) => [vehicle.id, vehicle]));
  const selectedRoute =
    result.routes.find((route) => route.vehicleId === selectedVehicleId) ??
    result.routes[0];
  const selectedVehicle = selectedRoute
    ? vehicleById.get(selectedRoute.vehicleId)
    : undefined;
  const costByVehicleId = new Map(
    result.operatingCost?.vehicles.map((item) => [
      item.vehicleId,
      item.breakdown,
    ]) ?? [],
  );

  return (
    <aside className="flex min-h-0 flex-col rounded-xl border border-border bg-card lg:w-[35%]">
      <header className="border-b border-border px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-semibold text-foreground">
              Vehicle assignments
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Select a route to focus the map and inspect its full sequence.
            </p>
          </div>
          <button
            className={cn(
              "shrink-0 rounded-lg border px-3 py-2 font-display text-xs font-semibold transition-colors",
              selectedVehicleId === null
                ? "border-primary-accent bg-primary-accent/10 text-primary-accent"
                : "border-border bg-surface text-foreground hover:bg-surface-low",
            )}
            onClick={() => onSelectedVehicleChange(null)}
            type="button"
          >
            All routes
          </button>
        </div>
      </header>

      <div className="border-b border-border bg-surface px-3 py-3">
        <div className="scrollbar-soft flex gap-2 overflow-x-auto pb-1">
          {result.routes.map((route) => {
            const vehicle = vehicleById.get(route.vehicleId);
            const selected = selectedVehicleId === route.vehicleId;
            const color = getVehicleRouteColor(route.vehicleId);

            return (
              <button
                className={cn(
                  "min-w-[180px] rounded-lg border bg-card px-3 py-2 text-left transition-colors",
                  selected
                    ? "border-primary-accent shadow-[0_4px_12px_rgba(0,0,0,0.06)]"
                    : "border-border hover:border-muted-foreground",
                )}
                key={route.vehicleId}
                onClick={() => onSelectedVehicleChange(route.vehicleId)}
                type="button"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span className="truncate font-display text-sm font-bold text-foreground">
                    {vehicle?.name ?? route.vehicleId}
                  </span>
                  {selected ? (
                    <Check aria-hidden className="ml-auto h-3.5 w-3.5 text-primary-accent" />
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {route.stops.length} stops | {formatDistanceKm(route)} |{" "}
                  {formatDuration(route.durationMinutes)}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {selectedRoute && selectedVehicle ? (
        <RouteDetail
          cost={costByVehicleId.get(selectedRoute.vehicleId)?.totalCostMinor}
          currency={result.operatingCost?.currency}
          route={selectedRoute}
          stopById={stopById}
          vehicle={selectedVehicle}
        />
      ) : (
        <div className="flex min-h-0 flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground">
          Select a vehicle route to inspect its stops.
        </div>
      )}
    </aside>
  );
}

function RouteDetail({
  cost,
  currency,
  route,
  stopById,
  vehicle,
}: {
  cost?: number;
  currency?: string;
  route: VehicleRouteResult;
  stopById: ReturnType<typeof routeLocationById>;
  vehicle: Vehicle;
}) {
  const problem = useOptimizationStore((state) => state.problem);
  const capacityDimensions = getCapacityDimensions(problem);
  const loadPercent = maxCapacityUsagePercent(route, vehicle, capacityDimensions);

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-border px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h4 className="truncate font-display text-lg font-bold text-foreground">
              {vehicle.name}
            </h4>
            <p className="mt-1 text-sm text-muted-foreground">
              {route.stops.length} stops | {formatDistanceKm(route)} |{" "}
              {formatDuration(route.durationMinutes)}
            </p>
            {typeof cost === "number" ? (
              <p className="mt-1 text-xs font-medium text-primary-accent">
                Estimated cost {formatMoneyMinor(cost, currency)}
              </p>
            ) : null}
          </div>
          <div className="shrink-0 text-right">
            <span className="rounded border border-border bg-surface px-2 py-1 font-display text-xs font-semibold text-foreground">
              {formatRouteCapacityUsage(route, vehicle, capacityDimensions)}
            </span>
            <p
              className={cn(
                "mt-1 text-xs text-muted-foreground",
                typeof loadPercent === "number" &&
                  loadPercent >= 95 &&
                  "font-medium text-destructive",
              )}
            >
              {formatLoadPercent(loadPercent)}
            </p>
          </div>
        </div>
      </div>

      <div className="scrollbar-soft min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <div className="relative ml-2 border-l-2 border-border pl-6">
          <TimelineDepot
            depot={formatLocationAddress(problem.depot)}
            time={formatSecondsAsClock(route.startTimeSeconds) ?? "Start"}
          />

          {route.stops.map((routeStop) => {
            const stop = stopById.get(routeStop.stopId);

            if (!stop) {
              return null;
            }

            return (
              <div className="mt-5" key={`${route.vehicleId}-${routeStop.stopId}`}>
                <TravelInfo
                  label={`${formatLegDuration(routeStop.durationFromPreviousMinutes)} | ${formatLegDistance(routeStop.distanceFromPreviousKm)}`}
                />
                <TimelineStop
                  address={stop.address}
                  label={stop.name}
                  note={
                    stop.timeWindow
                      ? `${routeStopActionLabel(routeStop.stopRole ?? stop.role)} | TW: ${
                          stop.timeWindow.start
                        }-${stop.timeWindow.end}`
                      : routeStopActionLabel(routeStop.stopRole ?? stop.role)
                  }
                  number={String(routeStop.order)}
                  time={routeStop.eta ?? "--:--"}
                />
              </div>
            );
          })}

          {problem.returnToDepot ? (
            <div className="mt-5">
              <TravelInfo label="Return to depot" />
              <TimelineReturn
                depot={formatLocationAddress(problem.depot)}
                time={formatSecondsAsClock(route.endTimeSeconds) ?? "Finish"}
              />
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function formatLoadPercent(value: number | undefined) {
  return typeof value === "number" ? `${value}% Load` : "Load not set";
}

function TimelineDepot({ depot, time }: { depot: string; time: string }) {
  return (
    <div className="relative">
      <span className="absolute -left-[31px] top-0 flex h-4 w-4 items-center justify-center rounded-sm border-2 border-card bg-foreground">
        <Warehouse aria-hidden className="h-2.5 w-2.5 text-card" />
      </span>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-display text-sm font-semibold text-foreground">
            Depot start
          </p>
          <p className="text-sm text-muted-foreground">{depot}</p>
        </div>
        <span className="shrink-0 font-display text-xs font-semibold text-foreground">
          {time}
        </span>
      </div>
    </div>
  );
}

function TimelineReturn({ depot, time }: { depot: string; time: string }) {
  return (
    <div className="relative">
      <span className="absolute -left-[31px] top-0 flex h-4 w-4 items-center justify-center rounded-sm border-2 border-card bg-foreground">
        <RotateCcw aria-hidden className="h-2.5 w-2.5 text-card" />
      </span>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-display text-sm font-semibold text-foreground">
            Return to depot
          </p>
          <p className="text-sm text-muted-foreground">{depot}</p>
        </div>
        <span className="shrink-0 font-display text-xs font-semibold text-foreground">
          {time}
        </span>
      </div>
    </div>
  );
}

function TimelineStop({
  address,
  label,
  note,
  number,
  time,
}: {
  address?: string;
  label: string;
  note?: string;
  number: string;
  time: string;
}) {
  return (
    <div className="relative">
      <span className="absolute -left-[31px] top-0 flex h-4 w-4 items-center justify-center rounded-full border-2 border-card bg-primary-accent text-[9px] font-bold text-white">
        {number}
      </span>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-display text-sm font-semibold text-foreground">
            {label}
          </p>
          {address ? (
            <p className="text-sm text-muted-foreground">{address}</p>
          ) : null}
          {note ? <p className="text-xs text-primary-accent">{note}</p> : null}
        </div>
        <span className="shrink-0 font-display text-xs font-semibold text-foreground">
          {time}
        </span>
      </div>
    </div>
  );
}

function TravelInfo({ label }: { label: string }) {
  return (
    <div className="relative -ml-2 mb-3 py-1">
      <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-border bg-surface-low px-3 py-1 text-xs text-muted-foreground">
        <ArrowDown aria-hidden className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{label}</span>
      </div>
    </div>
  );
}

function formatDistanceKm(route: VehicleRouteResult) {
  if (typeof route.distanceMeters === "number") {
    return `${(route.distanceMeters / 1000).toFixed(1)} km`;
  }

  return `${route.distanceKm} km`;
}

function formatLegDistance(distanceKm?: number) {
  return typeof distanceKm === "number" ? `${distanceKm} km` : "- km";
}

function formatLegDuration(durationMinutes?: number) {
  return typeof durationMinutes === "number"
    ? `${formatDuration(durationMinutes)}`
    : "- min";
}

function formatSecondsAsClock(seconds?: number) {
  if (typeof seconds !== "number") {
    return undefined;
  }

  const normalizedSeconds = ((seconds % 86400) + 86400) % 86400;
  const hours = Math.floor(normalizedSeconds / 3600);
  const minutes = Math.floor((normalizedSeconds % 3600) / 60);

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}
