"use client";

import { AlertCircle, CheckCircle2 } from "lucide-react";

import { getCapacityDimensions, maxCapacityUsagePercent } from "@/lib/capacity";
import { formatDuration } from "@/lib/formatters";
import { describeOptimizationStrategy } from "@/lib/optimization-strategy";
import { routeLocationCount } from "@/lib/routing-locations";
import { useOptimizationStore } from "@/providers/optimization-provider";

export function ResultSubtitle() {
  const problem = useOptimizationStore((state) => state.problem);
  const stopsCount = routeLocationCount(problem);
  const vehicleCount = useOptimizationStore(
    (state) => state.problem.vehicles.length,
  );

  return (
    <p className="mt-2 text-base text-muted-foreground">
      {stopsCount} deliveries | {vehicleCount} vehicles | Dec 14, 2023
    </p>
  );
}

export function ResultOverview() {
  const problem = useOptimizationStore((state) => state.problem);
  const result = useOptimizationStore((state) => state.result);

  if (!result) {
    return null;
  }

  const assignedStopCount = result.routes.reduce(
    (count, route) => count + route.stops.length,
    0,
  );
  const capacityDimensions = getCapacityDimensions(problem);
  const routeLoadPercents = result.routes.map((route) => {
    const vehicle = problem.vehicles.find(
      (item) => item.id === route.vehicleId,
    );

    return maxCapacityUsagePercent(route, vehicle, capacityDimensions) ?? 0;
  });
  const maxLoadPercent =
    routeLoadPercents.length > 0 ? Math.max(...routeLoadPercents) : 0;
  const totalOperations = routeLocationCount(problem);
  const strategySummary = describeOptimizationStrategy(
    problem.optimizationStrategy,
  );
  const metrics = [
    {
      label: "Total Distance",
      value: String(result.totalDistanceKm),
      suffix: "km",
    },
    {
      label: "Estimated Time",
      value: formatDuration(result.totalDurationMinutes),
    },
    {
      label: "Vehicles Used",
      value: String(result.vehiclesUsed),
      suffix: `/ ${problem.vehicles.length}`,
    },
    {
      label: "Deliveries Planned",
      value: String(result.servedStops || assignedStopCount),
      suffix: `/ ${totalOperations}`,
    },
  ];
  const validationItems = result.feasible
    ? [
        result.droppedStopsCount > 0
          ? `${result.servedStops || assignedStopCount} deliveries planned, ${
              result.droppedStopsCount
            } unscheduled`
          : `All ${assignedStopCount} operations assigned`,
        `Capacities respected (Max ${maxLoadPercent}%)`,
        "Hard constraints respected",
      ]
    : [
        "No feasible route found",
        ...(result.warnings.length > 0
          ? result.warnings
          : ["Review the routing constraints and try again."]),
      ];

  return (
    <section className="flex flex-col gap-6 lg:flex-row">
      <div className="flex-1 rounded-xl border border-border bg-card p-4">
        <h2 className="mb-3 font-display text-xs font-semibold uppercase text-muted-foreground">
          Plan summary
        </h2>
        <div className="mb-4 rounded-lg border border-border bg-surface-low p-3">
          <p className="font-display text-xs font-semibold uppercase text-muted-foreground">
            Optimized for
          </p>
          <p className="mt-1 font-display text-sm font-semibold text-foreground">
            {strategySummary.label}
          </p>
          {strategySummary.lines.length > 0 ? (
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {strategySummary.lines.slice(0, 3).join(" | ")}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2 text-sm text-foreground">
          {validationItems.map((item, index) => (
            <div className="flex items-center gap-2" key={item}>
              {result.feasible ? (
                <CheckCircle2
                  aria-hidden
                  className="h-4 w-4 text-primary-accent"
                />
              ) : (
                <AlertCircle
                  aria-hidden
                  className={
                    index === 0
                      ? "h-4 w-4 text-destructive"
                      : "h-4 w-4 text-amber-500"
                  }
                />
              )}
              {item}
            </div>
          ))}
        </div>
      </div>
      <div className="grid flex-[2] grid-cols-2 items-center gap-6 md:grid-cols-4">
        {metrics.map((metric) => (
          <div className="flex flex-col gap-1" key={metric.label}>
            <span className="font-display text-xs font-semibold uppercase text-muted-foreground">
              {metric.label}
            </span>
            <span className="font-display text-3xl font-semibold leading-none text-foreground md:text-5xl">
              {metric.value}
              {metric.suffix ? (
                <span className="ml-1 text-xl text-muted-foreground md:text-2xl">
                  {metric.suffix}
                </span>
              ) : null}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
