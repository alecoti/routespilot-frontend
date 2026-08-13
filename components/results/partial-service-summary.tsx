"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";

import {
  formatDeliveryPriority,
  formatDuration,
  formatServicePolicy,
  formatTimeWindow,
} from "@/lib/formatters";
import {
  type FrontendRouteLocation,
  routeLocationById,
  routeLocationsForProblem,
} from "@/lib/routing-locations";
import type {
  RouteStopResult,
  RoutingProblem,
  RoutingResult,
} from "@/lib/types";

export function PartialServiceSummary({
  problem,
  result,
}: {
  problem: RoutingProblem;
  result: RoutingResult;
}) {
  const routeStops = routeLocationsForProblem(problem);
  const stopById = routeLocationById(problem);
  const lateStops = result.routes.flatMap((route) =>
    route.stops
      .filter((stop) => (stop.timeWindowLatenessSeconds ?? 0) > 0)
      .map((routeStop) => ({
        routeStop,
        stop: stopById.get(routeStop.stopId),
      }))
      .filter((item) => Boolean(item.stop)),
  ) as { routeStop: RouteStopResult; stop: FrontendRouteLocation }[];
  const totalStops = routeStops.length;
  const requiredStops = routeStops.filter(
    (stop) => (stop.servicePolicy ?? "required") === "required",
  );
  const requiredServedCount = requiredStops.filter((stop) =>
    result.routes.some((route) =>
      route.stops.some((routeStop) => routeStop.stopId === stop.id),
    ),
  ).length;

  if (result.droppedStopsCount === 0 && lateStops.length === 0) {
    return (
      <section className="rounded-xl border border-primary-accent/20 bg-primary-accent/10 p-4">
        <p className="flex items-center gap-2 font-display text-sm font-semibold text-primary-accent">
          <CheckCircle2 aria-hidden className="h-4 w-4" />
          All deliveries scheduled
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {result.servedStops || totalStops} of {totalStops} deliveries are planned.
        </p>
      </section>
    );
  }

  return (
    <section className="grid gap-4 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-display text-xs font-semibold uppercase text-muted-foreground">
            Service status
          </p>
          <h2 className="mt-1 font-display text-lg font-semibold text-foreground">
            {result.servedStops} of {totalStops} deliveries planned
          </h2>
        </div>
        <div className="grid grid-cols-3 gap-3 text-right text-sm">
          <Metric label="Required served" value={`${requiredServedCount} / ${requiredStops.length}`} />
          <Metric label="Unscheduled" value={String(result.droppedStopsCount)} />
          <Metric label="Late flexible" value={String(lateStops.length)} />
        </div>
      </div>

      {result.droppedStops.length > 0 ? (
        <div>
          <p className="mb-2 flex items-center gap-2 font-display text-sm font-semibold text-foreground">
            <AlertTriangle aria-hidden className="h-4 w-4 text-amber-500" />
            Unscheduled deliveries
          </p>
          <div className="grid gap-2 md:grid-cols-2">
            {result.droppedStops.map((droppedStop) => {
              const stop = stopById.get(droppedStop.stopId);

              return (
                <article
                  className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3"
                  key={droppedStop.stopId}
                >
                  <p className="font-display text-sm font-semibold text-foreground">
                    {stop?.name ?? droppedStop.stopId}
                  </p>
                  {stop?.address ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {stop.address}
                    </p>
                  ) : null}
                  <p className="mt-2 text-xs font-medium text-amber-700">
                    {formatServicePolicy(droppedStop.servicePolicy)} |{" "}
                    {formatDeliveryPriority(droppedStop.priority)} priority
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      ) : null}

      {lateStops.length > 0 ? (
        <div>
          <p className="mb-2 flex items-center gap-2 font-display text-sm font-semibold text-foreground">
            <AlertTriangle aria-hidden className="h-4 w-4 text-amber-500" />
            Late flexible deliveries
          </p>
          <div className="grid gap-2 md:grid-cols-2">
            {lateStops.map(({ routeStop, stop }) => (
              <article
                className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3"
                key={routeStop.stopId}
              >
                <p className="font-display text-sm font-semibold text-foreground">
                  {stop.name}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  ETA {routeStop.eta ?? "--:--"} | Window{" "}
                  {formatTimeWindow(stop.timeWindow)}
                </p>
                <p className="mt-2 text-xs font-medium text-amber-700">
                  {formatDuration(
                    Math.round((routeStop.timeWindowLatenessSeconds ?? 0) / 60),
                  )}{" "}
                  late
                  {stop.timeWindow?.maxLatenessMinutes ? (
                    <> | allowed up to {stop.timeWindow.maxLatenessMinutes}m</>
                  ) : null}
                </p>
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-display text-[11px] font-semibold uppercase text-muted-foreground">
        {label}
      </p>
      <p className="font-display text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}
