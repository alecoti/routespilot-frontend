"use client";

import {
  describeOptimizationStrategy,
  getEffectiveOptimizationStrategy,
} from "@/lib/optimization-strategy";
import { formatMoneyMinor } from "@/lib/formatters";
import type { RoutingProblem, RoutingResult } from "@/lib/types";

export function OptimizationOutcome({
  problem,
  result,
}: {
  problem: RoutingProblem;
  result: RoutingResult;
}) {
  const strategy = getEffectiveOptimizationStrategy(problem);
  const strategyDescription = describeOptimizationStrategy(strategy);
  const metrics = result.objectiveMetrics;
  const travelTimeSeconds =
    metrics?.totalTravelTimeSeconds ??
    result.totalDurationSeconds ??
    result.totalDurationMinutes * 60;
  const distanceMeters =
    metrics?.totalDistanceMeters ??
    result.totalDistanceMeters ??
    Math.round(result.totalDistanceKm * 1000);
  const workloadSpanSeconds =
    metrics?.workloadSpanSeconds ?? routeWorkloadSpanSeconds(result);
  const operatingCost = result.operatingCost;
  const outcomeItems = [
    ...(operatingCost
      ? [
          {
            label: "Estimated operating cost",
            value: formatMoneyMinor(
              operatingCost.total.totalCostMinor,
              operatingCost.currency,
            ),
          },
        ]
      : []),
    {
      label: "Vehicles used",
      value: `${metrics?.vehiclesUsed ?? result.vehiclesUsed} / ${
        problem.vehicles.length
      }`,
    },
    {
      label: "Travel time",
      value: formatSecondsDuration(travelTimeSeconds),
    },
    {
      label: "Distance",
      value: `${formatKilometers(distanceMeters)} km`,
    },
    {
      label: "Workload difference",
      value: formatSecondsDuration(workloadSpanSeconds),
    },
  ];

  return (
    <section className="grid gap-4 rounded-xl border border-border bg-card p-4 lg:grid-cols-[0.9fr_1.1fr]">
      <div>
        <p className="font-display text-xs font-semibold uppercase text-muted-foreground">
          Optimization strategy
        </p>
        <h2 className="mt-2 font-display text-lg font-semibold text-foreground">
          {result.optimizationStrategySummary ?? strategyDescription.label}
        </h2>
        <div className="mt-3 grid gap-1 text-sm leading-6 text-muted-foreground">
          {(strategyDescription.lines.length > 0
            ? strategyDescription.lines
            : [strategyDescription.detail]
          )
            .slice(0, 4)
            .map((line) => (
              <p key={line}>{line}</p>
            ))}
        </div>
      </div>
      <div>
        <p className="font-display text-xs font-semibold uppercase text-muted-foreground">
          Outcome
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {outcomeItems.map((item) => (
            <div className="rounded-lg border border-border bg-surface p-3" key={item.label}>
              <p className="font-display text-xs font-semibold uppercase text-muted-foreground">
                {item.label}
              </p>
              <p className="mt-1 font-display text-xl font-semibold text-foreground">
                {item.value}
              </p>
            </div>
          ))}
        </div>
        {operatingCost ? (
          <div className="mt-3 rounded-lg border border-border bg-surface-low p-3 text-sm text-muted-foreground">
            <p className="font-display text-xs font-semibold uppercase text-muted-foreground">
              Cost breakdown
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-4">
              <CostLine
                label="Fixed"
                value={formatMoneyMinor(
                  operatingCost.total.fixedCostMinor,
                  operatingCost.currency,
                )}
              />
              <CostLine
                label="Distance"
                value={formatMoneyMinor(
                  operatingCost.total.distanceCostMinor,
                  operatingCost.currency,
                )}
              />
              <CostLine
                label="Working time"
                value={formatMoneyMinor(
                  operatingCost.total.timeCostMinor,
                  operatingCost.currency,
                )}
              />
              <CostLine
                label="Overtime"
                value={formatMoneyMinor(
                  operatingCost.total.overtimeCostMinor,
                  operatingCost.currency,
                )}
              />
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function CostLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-display text-xs font-semibold text-foreground">{value}</p>
      <p className="text-xs">{label}</p>
    </div>
  );
}

function routeWorkloadSpanSeconds(result: RoutingResult) {
  const workloads = result.routes.map((route) => {
    if (
      typeof route.startTimeSeconds === "number" &&
      typeof route.endTimeSeconds === "number"
    ) {
      return Math.max(0, route.endTimeSeconds - route.startTimeSeconds);
    }

    return route.durationSeconds ?? route.durationMinutes * 60;
  });

  if (workloads.length === 0) {
    return 0;
  }

  return Math.max(...workloads) - Math.min(...workloads);
}

function formatKilometers(meters: number) {
  return Number((meters / 1000).toFixed(1));
}

function formatSecondsDuration(seconds: number) {
  const minutes = Math.round(Math.max(0, seconds) / 60);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return hours > 0 ? `${hours}h ${remainingMinutes}m` : `${remainingMinutes}m`;
}
