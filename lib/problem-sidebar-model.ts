import { formatOptimizationStrategy } from "@/lib/formatters";
import { formatCapacityValue, vehicleCapacityValue } from "@/lib/capacity";
import { getLocationAddress } from "@/lib/locations";
import {
  getEffectiveOptimizationStrategy,
  validateOptimizationStrategy,
} from "@/lib/optimization-strategy";
import { assessConversationReadiness } from "@/lib/conversation-readiness";
import type { ImportedFileState } from "@/lib/conversation-types";
import type {
  CapacityDimensionDefinition,
  RoutingProblem,
  Vehicle,
} from "@/lib/types";
import { getActiveCapacityDimensions } from "@/lib/problem-understanding";

export type SidebarSectionStatus = "complete" | "incomplete" | "warning" | "error";

export type SidebarSectionIconKey =
  | "route"
  | "deliveries"
  | "vehicles"
  | "constraints"
  | "optimization"
  | "files";

export type SidebarSectionModel = {
  details: string[];
  iconKey: SidebarSectionIconKey;
  label: string;
  status: SidebarSectionStatus;
  summary: string;
};

export type SidebarSyncSnapshot = {
  depot: string | null;
  vehicles: number;
  stops: number;
  strategy: string;
};

export function buildProblemSidebarSections({
  importedFile,
  problem,
}: {
  importedFile: ImportedFileState | null;
  problem: RoutingProblem;
}): SidebarSectionModel[] {
  const readiness = assessConversationReadiness(problem);
  const activeCapacityDimensions = getActiveCapacityDimensions(problem);
  const unresolvedStopCount = readiness.unresolvedLocations.filter(
    (location) => location.type === "stop",
  ).length;
  const missingVehicleCapacityCount = readiness.missingRequirements.filter(
    (requirement) => requirement.code === "MISSING_VEHICLE_CAPACITY",
  ).length;
  const strategy = getEffectiveOptimizationStrategy(problem);
  const strategyIssues = strategy ? validateOptimizationStrategy(strategy) : [];
  const timeWindowCount = problem.stops.filter((stop) => stop.timeWindow).length;
  const serviceTimeCount = problem.stops.filter(
    (stop) => typeof stop.serviceTimeSeconds === "number",
  ).length;
  const optionalCount = problem.stops.filter(
    (stop) => stop.servicePolicy === "optional",
  ).length;
  const preferredCount = problem.stops.filter(
    (stop) => stop.servicePolicy === "preferred",
  ).length;
  const sections: SidebarSectionModel[] = [
    {
      label: "Route",
      iconKey: "route",
      summary: problem.depot
        ? formatDepot(getLocationAddress(problem.depot) ?? problem.depot.address)
        : "Depot not set",
      status: problem.depot ? "complete" : "incomplete",
      details: problem.depot
        ? [problem.returnToDepot ? "Returns to depot" : "Finishes at last stop"]
        : ["Add the depot address."],
    },
    {
      label: "Deliveries",
      iconKey: "deliveries",
      summary:
        problem.stops.length > 0
          ? `${problem.stops.length} stops`
          : "No deliveries loaded",
      status:
        problem.stops.length === 0
          ? "incomplete"
          : unresolvedStopCount > 0
            ? "warning"
            : "complete",
      details: [
        timeWindowCount > 0 ? `${timeWindowCount} time windows` : null,
        serviceTimeCount > 0 ? `${serviceTimeCount} service times` : null,
        preferredCount > 0 ? `${preferredCount} preferred deliveries` : null,
        optionalCount > 0 ? `${optionalCount} optional deliveries` : null,
        unresolvedStopCount > 0 ? `${unresolvedStopCount} locations need review` : null,
        importedFile?.status === "success" ? `Source: ${importedFile.fileName}` : null,
      ].filter((detail): detail is string => Boolean(detail)),
    },
    {
      label: "Vehicles",
      iconKey: "vehicles",
      summary:
        problem.vehicles.length > 0
          ? `${problem.vehicles.length} vehicles`
          : "No vehicles configured",
      status:
        problem.vehicles.length === 0
          ? "incomplete"
          : missingVehicleCapacityCount > 0
            ? "warning"
            : "complete",
      details:
        problem.vehicles.length > 0
          ? problem.vehicles.map((vehicle) =>
              formatVehicleLine(vehicle, activeCapacityDimensions),
            )
          : ["Add at least one vehicle."],
    },
    {
      label: "Constraints",
      iconKey: "constraints",
      summary: buildConstraintsSummary({
        serviceTimeCount,
        timeWindowCount,
      }),
      status: timeWindowCount > 0 || serviceTimeCount > 0 ? "complete" : "incomplete",
      details: [
        timeWindowCount > 0 ? `${timeWindowCount} delivery windows` : null,
        serviceTimeCount > 0 ? `${serviceTimeCount} service durations` : null,
        activeCapacityDimensions.length > 0
          ? `Load types: ${activeCapacityDimensions
              .map((dimension) => dimension.label)
              .join(", ")}`
          : null,
      ].filter((detail): detail is string => Boolean(detail)),
    },
    {
      label: "Optimization",
      iconKey: "optimization",
      summary: formatSidebarStrategy(strategy),
      status: !strategy
        ? "incomplete"
        : strategyIssues.length > 0
          ? "error"
          : "complete",
      details:
        strategyIssues.length > 0
          ? strategyIssues.map((issue) => issue.message)
          : formatStrategyDetails(strategy),
    },
  ];

  if (importedFile) {
    sections.push({
      label: "Files",
      iconKey: "files",
      summary: importedFile.fileName,
      status: importedFile.status === "failed"
        ? "error"
        : importedFile.status === "success"
          ? "complete"
          : "warning",
      details: [
        formatImportedFileStatus(importedFile),
        ...(importedFile.warnings ?? []),
      ],
    });
  }

  return sections;
}

export function buildSidebarSyncSnapshot(
  problem: RoutingProblem,
): SidebarSyncSnapshot {
  return {
    depot: problem.depot ? getLocationAddress(problem.depot) ?? problem.depot.address : null,
    vehicles: problem.vehicles.length,
    stops: problem.stops.length,
    strategy: formatSidebarStrategy(getEffectiveOptimizationStrategy(problem)),
  };
}

function formatDepot(address: string) {
  const parts = address.split(",").map((part) => part.trim()).filter(Boolean);

  return parts.length > 1 ? `${parts[0]}, ${parts[1]}` : address;
}

function formatVehicleLine(
  vehicle: Vehicle,
  dimensions: CapacityDimensionDefinition[],
) {
  const values = dimensions
    .map((dimension) =>
      formatCapacityValue(vehicleCapacityValue(vehicle, dimension.key), dimension),
    )
    .filter(Boolean);

  return values.length > 0
    ? `${vehicle.name}: ${values.join(" · ")}`
    : `${vehicle.name}: capacity not configured`;
}

function buildConstraintsSummary({
  serviceTimeCount,
  timeWindowCount,
}: {
  serviceTimeCount: number;
  timeWindowCount: number;
}) {
  const parts = [
    timeWindowCount > 0 ? `${timeWindowCount} time windows` : null,
    serviceTimeCount > 0 ? `${serviceTimeCount} service times` : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" · ") : "No delivery constraints yet";
}

function formatStrategyDetails(
  strategy: ReturnType<typeof getEffectiveOptimizationStrategy>,
) {
  if (!strategy) {
    return ["Choose what RoutesPilot should optimize."];
  }

  if (strategy.mode === "priority") {
    return strategy.objectives
      .filter((objective) => objective.enabled)
      .sort((first, second) => first.priority - second.priority)
      .slice(0, 5)
      .map((objective, index) => `${index + 1}. ${formatObjective(objective.type)}`);
  }

  if (strategy.mode === "advanced") {
    return strategy.objectives
      .filter((objective) => objective.enabled)
      .map(
        (objective) =>
          `${formatObjective(objective.type)} ${Math.round((objective.weight ?? 0) * 100)}%`,
      );
  }

  return [];
}

function formatSidebarStrategy(
  strategy: ReturnType<typeof getEffectiveOptimizationStrategy>,
) {
  if (strategy?.mode === "priority") {
    const objectives = strategy.objectives
      .filter((objective) => objective.enabled)
      .sort((first, second) => first.priority - second.priority)
      .map((objective) => formatObjective(objective.type));

    return objectives.length > 0 ? objectives.join(" -> ") : "Set priorities";
  }

  return formatOptimizationStrategy(strategy);
}

function formatObjective(type: string) {
  const labels: Record<string, string> = {
    balance_workload: "Balance",
    minimize_distance: "Distance",
    minimize_operating_cost: "Cost",
    minimize_time: "Time",
    minimize_vehicles: "Vehicles",
  };

  return labels[type] ?? type;
}

function formatImportedFileStatus(importedFile: ImportedFileState) {
  if (importedFile.status === "success") {
    return `${importedFile.validRowCount ?? 0} deliveries imported`;
  }

  if (importedFile.status === "failed") {
    return importedFile.error ?? "Import failed";
  }

  if (importedFile.status === "needs_mapping") {
    return "Column mapping needs review";
  }

  if (importedFile.status === "needs_review") {
    return `${importedFile.validRowCount ?? 0} valid rows ready`;
  }

  return "Reading deliveries";
}
