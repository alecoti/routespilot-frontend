"use client";

import {
  Clock3,
  LocateFixed,
  PackageCheck,
  Route,
  SlidersHorizontal,
  Truck,
} from "lucide-react";

import {
  formatCapacityValue,
  formatStopDemands,
  vehicleCapacityValue,
} from "@/lib/capacity";
import {
  formatDeliveryPriority,
  formatOptimizationStrategy,
  formatServicePolicy,
  formatTimeWindow,
} from "@/lib/formatters";
import { formatLocationAddress } from "@/lib/locations";
import {
  getActiveCapacityDimensions,
  inferProblemUnderstanding,
} from "@/lib/problem-understanding";
import { getEffectiveOptimizationStrategy } from "@/lib/optimization-strategy";
import { routeLocationsForProblem } from "@/lib/routing-locations";
import type { CapacityDimensionDefinition, RoutingProblem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useOptimizationStore } from "@/providers/optimization-provider";

export function ProblemPreviewSummary() {
  const problem = useOptimizationStore((state) => state.problem);
  const understanding = inferProblemUnderstanding(problem);
  const routeLocations = routeLocationsForProblem(problem);
  const strategy = getEffectiveOptimizationStrategy(problem);
  const activeCapacityDimensions = getActiveCapacityDimensions(problem);
  const requiredCount = routeLocations.filter(
    (stop) => (stop.servicePolicy ?? "required") === "required",
  ).length;
  const flexibleWindowCount = routeLocations.filter(
    (stop) => stop.timeWindow?.mode === "soft",
  ).length;
  const sampleStops = routeLocations.slice(0, 5);

  return (
    <section className="mb-8 rounded-lg border border-border bg-card">
      <div className="border-b border-border p-5">
        <p className="font-display text-xs font-semibold uppercase text-muted-foreground">
          Problem preview
        </p>
        <h2 className="mt-1 font-display text-2xl font-semibold text-foreground">
          This is the route problem RoutesPilot will solve
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Check the operational facts before generating the optimization. The
          solver will only use the constraints that are active in this problem.
        </p>
      </div>

      <div className="grid gap-0 md:grid-cols-2 xl:grid-cols-3">
        <PreviewTile
          details={[
            formatLocationAddress(problem.depot) ?? "Depot not set",
            typeof problem.returnToDepot === "boolean"
              ? problem.returnToDepot
                ? "Vehicles return to depot"
                : "Vehicles finish at last stop"
              : "Return rule not set",
          ]}
          icon={LocateFixed}
          label="Route"
          status={problem.depot ? "complete" : "incomplete"}
          value={problem.depot ? "Depot configured" : "Missing depot"}
        />
        <PreviewTile
          details={[
            `${routeLocations.length} route locations`,
            `${requiredCount} required operations`,
            flexibleWindowCount > 0
              ? `${flexibleWindowCount} flexible windows`
              : "No flexible windows",
          ]}
          icon={PackageCheck}
          label="Operations"
          status={routeLocations.length > 0 ? "complete" : "incomplete"}
          value={`${problem.stops.length} deliveries`}
        />
        <PreviewTile
          details={vehicleLines(problem, activeCapacityDimensions)}
          icon={Truck}
          label="Vehicles"
          status={problem.vehicles.length > 0 ? "complete" : "incomplete"}
          value={`${problem.vehicles.length} vehicles`}
        />
        <PreviewTile
          details={[
            understanding.activeConstraints.capacity
              ? `Load types: ${activeCapacityDimensions
                  .map((dimension) => dimension.label)
                  .join(", ")}`
              : "No load constraints",
            understanding.activeConstraints.timeWindows
              ? `${routeLocations.filter((stop) => stop.timeWindow).length} time windows`
              : "No time windows",
            understanding.activeConstraints.serviceTimes
              ? `${routeLocations.filter((stop) => stop.serviceTimeSeconds).length} service times`
              : "No service times",
          ]}
          icon={Clock3}
          label="Requirements"
          status="complete"
          value={
            understanding.activeConstraints.capacity ||
            understanding.activeConstraints.timeWindows ||
            understanding.activeConstraints.serviceTimes
              ? "Active constraints"
              : "Simple routing"
          }
        />
        <PreviewTile
          details={strategyDetails(strategy)}
          icon={SlidersHorizontal}
          label="Strategy"
          status={strategy ? "complete" : "incomplete"}
          value={formatOptimizationStrategy(strategy)}
        />
        <PreviewTile
          details={[
            `${sampleStops.length} shown here`,
            routeLocations.length > sampleStops.length
              ? `${routeLocations.length - sampleStops.length} more in details`
              : "All operations visible",
          ]}
          icon={Route}
          label="Stop sample"
          status={sampleStops.length > 0 ? "complete" : "incomplete"}
          value={sampleStops[0]?.name ?? "No stops"}
        />
      </div>

      {sampleStops.length > 0 ? (
        <div className="border-t border-border p-5">
          <p className="mb-3 font-display text-xs font-semibold uppercase text-muted-foreground">
            First operations
          </p>
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-low">
                  {["Customer", "Address", "Load", "Window", "Priority", "Requirement"].map(
                    (head) => (
                      <th
                        className="px-3 py-2 font-display text-xs font-semibold text-muted-foreground"
                        key={head}
                      >
                        {head}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {sampleStops.map((stop) => (
                  <tr className="border-b border-border last:border-b-0" key={stop.id}>
                    <td className="px-3 py-2 font-medium text-foreground">
                      {stop.name}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {stop.address}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {formatStopDemands(stop, activeCapacityDimensions)}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {formatTimeWindow(stop.timeWindow)}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {formatDeliveryPriority(stop.priority)}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {formatServicePolicy(stop.servicePolicy)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function PreviewTile({
  details,
  icon: Icon,
  label,
  status,
  value,
}: {
  details: string[];
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  status: "complete" | "incomplete";
  value: string;
}) {
  return (
    <div className="border-b border-border p-5 md:border-r xl:[&:nth-child(3n)]:border-r-0">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
            status === "complete"
              ? "bg-primary-accent/10 text-primary-accent"
              : "bg-surface-container text-muted-foreground",
          )}
        >
          <Icon aria-hidden className="h-4 w-4" strokeWidth={1.8} />
        </div>
        <div className="min-w-0">
          <p className="font-display text-xs font-semibold uppercase text-muted-foreground">
            {label}
          </p>
          <p className="mt-1 break-words font-display text-base font-semibold text-foreground">
            {value}
          </p>
        </div>
      </div>
      <ul className="mt-4 space-y-1.5 pl-12 text-sm leading-6 text-muted-foreground">
        {details.filter(Boolean).slice(0, 5).map((detail) => (
          <li className="break-words" key={detail}>
            {detail}
          </li>
        ))}
      </ul>
    </div>
  );
}

function vehicleLines(
  problem: RoutingProblem,
  dimensions: CapacityDimensionDefinition[],
) {
  if (problem.vehicles.length === 0) {
    return ["Add at least one vehicle"];
  }

  return problem.vehicles.slice(0, 5).map((vehicle) => {
    const capacities = dimensions
      .map((dimension) =>
        formatCapacityValue(vehicleCapacityValue(vehicle, dimension.key), dimension),
      )
      .filter(Boolean);

    return capacities.length > 0
      ? `${vehicle.name}: ${capacities.join(" | ")}`
      : `${vehicle.name}: no load capacity needed`;
  });
}

function strategyDetails(strategy: ReturnType<typeof getEffectiveOptimizationStrategy>) {
  if (!strategy) {
    return ["Choose an optimization strategy"];
  }

  return strategy.objectives
    .filter((objective) => objective.enabled)
    .sort((first, second) => first.priority - second.priority)
    .slice(0, 5)
    .map((objective, index) => `${index + 1}. ${formatObjective(objective.type)}`);
}

function formatObjective(type: string) {
  const labels: Record<string, string> = {
    balance_workload: "Balance workload",
    minimize_distance: "Reduce distance",
    minimize_operating_cost: "Reduce operating cost",
    minimize_time: "Reduce travel time",
    minimize_vehicles: "Use fewer vehicles",
  };

  return labels[type] ?? type;
}
