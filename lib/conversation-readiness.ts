import { vehicleCapacityValue } from "@/lib/capacity";
import {
  getVehicleCapacityRequirements,
  validateRoutingProblem,
} from "@/lib/routing-validation";
import type {
  ConversationConflict,
  ConversationMissingRequirement,
  ConversationNextActionCandidate,
  ConversationUnresolvedLocation,
  ReadinessAssessment,
} from "@/lib/conversation-types";
import type { DeliveryStop, GeoLocation, RoutingProblem } from "@/lib/types";
import { inferProblemUnderstanding } from "@/lib/problem-understanding";

export function assessConversationReadiness(
  problem: RoutingProblem,
): ReadinessAssessment {
  const validation = validateRoutingProblem(problem);
  const understanding = inferProblemUnderstanding(problem);
  const missingRequirements = [
    ...validation.issues
      .filter((issue) => issue.severity === "missing")
      .map((issue) => ({
        code: issue.code,
        field: issue.field,
        message: issue.message,
        category: categoryForField(issue.field),
        severity: "missing" as const,
      })),
    ...(understanding.activeConstraints.capacity
      ? missingVehicleCapacityRequirements(problem)
      : []),
  ];
  const capacityMissingFields = new Set(
    missingRequirements
      .filter((requirement) => requirement.code === "MISSING_VEHICLE_CAPACITY")
      .map((requirement) => requirement.field),
  );
  const conflicts: ConversationConflict[] = validation.issues
    .filter((issue) => issue.severity === "invalid")
    .filter(
      (issue) =>
        issue.code !== "INVALID_VEHICLE_CAPACITY" ||
        !capacityMissingFields.has(issue.field),
    )
    .map((issue) => ({
      code: issue.code,
      field: issue.field,
      message: issue.message,
    }));
  const unresolvedLocations = getUnresolvedLocations(problem);
  const blockers = [
    ...conflicts,
    ...unresolvedLocations.map((location) => ({
      code: "UNRESOLVED_LOCATION",
      field:
        location.type === "depot"
          ? "depot.address"
          : `stops.${location.id}.address`,
      message: location.message,
      affectedStopIds: location.type === "stop" ? [location.id] : [],
    })),
  ];
  const readyForReview = missingRequirements.length === 0;
  const readyForOptimization =
    readyForReview && blockers.length === 0 && unresolvedLocations.length === 0;
  const nextActionCandidates = buildNextActionCandidates({
    blockers,
    missingRequirements,
    readyForOptimization,
    readyForReview,
    unresolvedLocations,
  });

  return {
    readyForReview,
    readyForOptimization,
    missingRequirements,
    unresolvedLocations,
    ambiguities: [],
    blockers,
    conflicts,
    warnings: validation.warnings,
    nextActionCandidates,
  };
}

function missingVehicleCapacityRequirements(
  problem: RoutingProblem,
): ConversationMissingRequirement[] {
  return getVehicleCapacityRequirements(problem).flatMap((requirement) =>
    requirement.missingVehicleIds.flatMap((vehicleId) => {
      const vehicle = problem.vehicles.find((candidate) => candidate.id === vehicleId);
      const value = vehicle
        ? vehicleCapacityValue(vehicle, requirement.dimension.key)
        : undefined;

      if (typeof value === "number" && Number.isFinite(value) && value < 0) {
        return [];
      }

      const vehicleName = vehicle?.name ?? vehicleId;

      return [
        {
          code: "MISSING_VEHICLE_CAPACITY",
          field: vehicle
            ? `vehicles.${problem.vehicles.indexOf(vehicle)}.capacities.${requirement.dimension.key}`
            : `vehicles.capacities.${requirement.dimension.key}`,
          message: `${vehicleName} needs ${requirement.dimension.label.toLowerCase()} capacity.`,
          category: "vehicles" as const,
          entityType: "vehicle" as const,
          entityId: vehicleId,
          entityName: vehicleName,
          dimensionKey: requirement.dimension.key,
          dimensionLabel: requirement.dimension.label,
          expectedUnit: requirement.dimension.unit,
          severity: "missing" as const,
          vehicleIds: [vehicleId],
        },
      ];
    }),
  );
}

function getUnresolvedLocations(
  problem: RoutingProblem,
): ConversationUnresolvedLocation[] {
  const locations: ConversationUnresolvedLocation[] = [];

  if (problem.depot) {
    const depotState = unresolvedLocationState(problem.depot);

    if (depotState) {
      locations.push({
        id: "depot",
        type: "depot",
        name: "Depot",
        address: problem.depot.address,
        status: depotState.status,
        message: depotState.message,
      });
    }
  }

  routeStopsForProblem(problem).forEach((stop) => {
    const stopState = unresolvedLocationState(stop);

    if (stopState) {
      locations.push({
        id: stop.id,
        type: "stop",
        name: stop.name,
        address: stop.address,
        status: stopState.status,
        message: stopState.message,
      });
    }
  });

  return locations;
}

function unresolvedLocationState(location: GeoLocation) {
  if (location.geocodingStatus === "needs_review") {
    return {
      status: "needs_review" as const,
      message: "Review the suggested location before optimizing.",
    };
  }

  if (
    location.geocodingStatus === "not_found" ||
    location.geocodingStatus === "failed"
  ) {
    return {
      status: location.geocodingStatus,
      message: "Resolve this address before optimizing.",
    };
  }

  if (
    location.geocodingStatus === "pending" &&
    (typeof location.latitude !== "number" ||
      typeof location.longitude !== "number")
  ) {
    return {
      status: "pending" as const,
      message: "This address still needs coordinates.",
    };
  }

  return null;
}

function buildNextActionCandidates({
  blockers,
  missingRequirements,
  readyForOptimization,
  readyForReview,
  unresolvedLocations,
}: {
  blockers: ConversationConflict[];
  missingRequirements: ConversationMissingRequirement[];
  readyForOptimization: boolean;
  readyForReview: boolean;
  unresolvedLocations: ConversationUnresolvedLocation[];
}): ConversationNextActionCandidate[] {
  if (missingRequirements.length > 0) {
    return [
      {
        type: "ASK_MISSING_INFORMATION",
        label: missingRequirements[0].message,
        field: missingRequirements[0].field,
        priority: 10,
      },
    ];
  }

  if (unresolvedLocations.length > 0) {
    return [
      {
        type: "REVIEW_LOCATIONS",
        label: "Review unresolved locations.",
        field: "locations",
        priority: 20,
      },
    ];
  }

  if (blockers.length > 0) {
    return [
      {
        type: "SHOW_BLOCKER",
        label: blockers[0].message,
        field: blockers[0].field,
        priority: 30,
      },
    ];
  }

  if (readyForOptimization) {
    return [
      {
        type: "READY_TO_OPTIMIZE",
        label: "Ready to optimize.",
        priority: 50,
      },
    ];
  }

  if (readyForReview) {
    return [
      {
        type: "PROCEED_TO_REVIEW",
        label: "Ready for review.",
        priority: 40,
      },
    ];
  }

  return [];
}

function categoryForField(
  field: string,
): ConversationMissingRequirement["category"] {
  if (field.startsWith("vehicles")) {
    return "vehicles";
  }

  if (field.startsWith("stops") || field.startsWith("jobs")) {
    return "deliveries";
  }

  if (field.startsWith("depot")) {
    return "route";
  }

  if (field.includes("strategy") || field.includes("objective")) {
    return "strategy";
  }

  return "route";
}

function routeStopsForProblem(problem: RoutingProblem): DeliveryStop[] {
  return [
    ...problem.stops,
    ...(problem.jobs ?? []).flatMap((job) => {
      if (job.type === "delivery" && job.deliveryStop) {
        return [job.deliveryStop];
      }

      if (job.type === "pickup_delivery" && job.pickupDelivery) {
        return [job.pickupDelivery.pickup, job.pickupDelivery.delivery];
      }

      return [];
    }),
  ];
}
