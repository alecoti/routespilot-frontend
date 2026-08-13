import {
  describeOptimizationStrategy,
  strategyFromLegacyObjective,
} from "@/lib/optimization-strategy";
import type {
  OptimizationObjective,
  DeliveryPriority,
  OptimizationStrategy,
  ServicePolicy,
  TimeWindow,
  TimeWindowMode,
} from "@/lib/types";

export function formatObjective(objective?: OptimizationObjective) {
  switch (objective) {
    case "balance_workload":
      return "Balance workload";
    case "minimize_distance":
      return "Minimize distance";
    case "minimize_vehicles":
      return "Fewer vehicles";
    case "minimize_operating_cost":
      return "Operating cost";
    case "minimize_time":
      return "Minimize time";
    default:
      return "Not selected";
  }
}

export function formatObjectiveDescription(objective?: OptimizationObjective) {
  switch (objective) {
    case "balance_workload":
      return "Even distribution of stops.";
    case "minimize_distance":
      return "Fewer kilometers travelled.";
    case "minimize_vehicles":
      return "Maximize load per vehicle.";
    case "minimize_operating_cost":
      return "Prefer lower operating cost.";
    case "minimize_time":
      return "Lowest overall driving time.";
    default:
      return "Select how RoutesPilot should optimize the plan.";
  }
}

export function formatOptimizationStrategy(
  strategy?: OptimizationStrategy,
  legacyObjective?: OptimizationObjective,
) {
  return describeOptimizationStrategy(
    strategy ?? strategyFromLegacyObjective(legacyObjective),
  ).label;
}

export function formatTimeWindow(timeWindow?: TimeWindow) {
  return timeWindow ? `${timeWindow.start} - ${timeWindow.end}` : "-";
}

export function formatDeliveryPriority(priority?: DeliveryPriority) {
  return titleCase(priority ?? "normal");
}

export function formatServicePolicy(policy?: ServicePolicy) {
  return titleCase(policy ?? "required");
}

export function formatTimeWindowMode(mode?: TimeWindowMode) {
  return mode === "soft" ? "Flexible" : "Hard";
}

export function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return hours > 0 ? `${hours}h ${remainingMinutes}m` : `${remainingMinutes}m`;
}

export function formatMoneyMinor(value: number | undefined, currency = "EUR") {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "-";
  }

  return new Intl.NumberFormat("en-US", {
    currency,
    style: "currency",
  }).format(value / 100);
}

function titleCase(value: string) {
  return value.replace("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
