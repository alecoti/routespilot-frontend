import {
  defaultCapacityDimension,
  ensureCapacityDimensions,
  getCapacityConstraintDimensions,
  stopDemandValue,
  vehicleCapacityValue,
} from "@/lib/capacity";
import {
  getEffectiveOptimizationStrategy,
  validateOptimizationStrategy,
} from "@/lib/optimization-strategy";
import type {
  CapacityDimensionDefinition,
  DeliveryStop,
  RoutingProblem,
  TimeWindow,
} from "@/lib/types";

const validPriorities = new Set(["critical", "high", "normal", "low"]);
const validServicePolicies = new Set(["required", "preferred", "optional"]);

export type RoutingValidationIssue = {
  field: string;
  code: string;
  message: string;
  severity: "missing" | "invalid" | "warning";
};

export type RoutingValidationResult = {
  ready: boolean;
  issues: RoutingValidationIssue[];
  missingFields: string[];
  invalidFields: string[];
  warnings: string[];
};

export function validateRoutingProblem(
  problem: RoutingProblem,
): RoutingValidationResult {
  const routeStops = routeStopsForProblem(problem);
  const issues: RoutingValidationIssue[] = [
    ...validateIdentity(problem),
    ...validateDepot(problem),
    ...validateVehicles(problem),
    ...validateStops(problem),
    ...validateReturnToDepot(problem),
    ...validateStrategy(problem),
    ...validateOperatingCosts(problem),
    ...validateCapacity(problem),
    ...validateDuplicateIds(
      "vehicles",
      problem.vehicles.map((vehicle) => vehicle.id),
      "DUPLICATE_VEHICLE_ID",
      "Vehicle IDs must be unique.",
    ),
    ...validateDuplicateIds(
      "stops",
      routeStops.map((stop) => stop.id),
      "DUPLICATE_STOP_ID",
      "Route stop IDs must be unique.",
    ),
  ];

  const blockingIssues = issues.filter(
    (issue) => issue.severity === "missing" || issue.severity === "invalid",
  );

  return {
    ready: blockingIssues.length === 0,
    issues,
    missingFields: issues
      .filter((issue) => issue.severity === "missing")
      .map((issue) => issue.field),
    invalidFields: issues
      .filter((issue) => issue.severity === "invalid")
      .map((issue) => issue.field),
    warnings: issues
      .filter((issue) => issue.severity === "warning")
      .map((issue) => issue.message),
  };
}

export type VehicleCapacityRequirement = {
  dimension: CapacityDimensionDefinition;
  missingVehicleIds: string[];
};

export function getVehicleCapacityRequirements(
  problem: RoutingProblem,
): VehicleCapacityRequirement[] {
  const routeStops = routeStopsForProblem(problem);
  const dimensions = capacityDimensionsForDemand(problem, routeStops);

  return dimensions
    .map((dimension) => ({
      dimension,
      missingVehicleIds: problem.vehicles
        .filter(
          (vehicle) =>
            !isValidNonNegativeNumber(vehicleCapacityValue(vehicle, dimension.key)),
        )
        .map((vehicle) => vehicle.id),
    }))
    .filter((requirement) => requirement.missingVehicleIds.length > 0);
}

export function hasCompleteVehicleCapacities(problem: RoutingProblem) {
  return getVehicleCapacityRequirements(problem).length === 0;
}

function validateIdentity(problem: RoutingProblem): RoutingValidationIssue[] {
  return [
    requiredStringIssue("id", problem.id, "MISSING_PROBLEM_ID", "Problem ID is required."),
    requiredStringIssue(
      "name",
      problem.name,
      "MISSING_PROBLEM_NAME",
      "Problem name is required.",
    ),
  ].filter(Boolean) as RoutingValidationIssue[];
}

function validateDepot(problem: RoutingProblem): RoutingValidationIssue[] {
  const issue = requiredStringIssue(
    "depot.address",
    problem.depot?.address,
    "MISSING_DEPOT",
    "Depot is required.",
  );

  return issue ? [issue] : [];
}

function validateVehicles(problem: RoutingProblem): RoutingValidationIssue[] {
  const issues: RoutingValidationIssue[] = [];

  if (problem.vehicles.length === 0) {
    issues.push({
      field: "vehicles",
      code: "NO_VEHICLES",
      message: "At least one vehicle is required.",
      severity: "missing",
    });
  }

  problem.vehicles.forEach((vehicle, index) => {
    const idIssue = requiredStringIssue(
      `vehicles.${index}.id`,
      vehicle.id,
      "MISSING_VEHICLE_ID",
      "Vehicle ID is required.",
    );
    const nameIssue = requiredStringIssue(
      `vehicles.${index}.name`,
      vehicle.name,
      "MISSING_VEHICLE_NAME",
      "Vehicle name is required.",
    );

    if (idIssue) {
      issues.push(idIssue);
    }

    if (nameIssue) {
      issues.push(nameIssue);
    }
  });

  return issues;
}

function validateStops(problem: RoutingProblem): RoutingValidationIssue[] {
  const issues: RoutingValidationIssue[] = [];
  const routeStops = routeStopsForProblem(problem);

  if (routeStops.length === 0) {
    issues.push({
      field: "stops",
      code: "NO_STOPS",
      message: "At least one delivery or pickup-delivery job is required.",
      severity: "missing",
    });
  }

  routeStops.forEach((stop, index) => {
    const idIssue = requiredStringIssue(
      `stops.${index}.id`,
      stop.id,
      "MISSING_STOP_ID",
      "Delivery stop ID is required.",
    );
    const nameIssue = requiredStringIssue(
      `stops.${index}.name`,
      stop.name,
      "MISSING_STOP_NAME",
      "Delivery stop name is required.",
    );
    const addressIssue = requiredStringIssue(
      `stops.${index}.address`,
      stop.address,
      "MISSING_STOP_ADDRESS",
      "Delivery stop address is required.",
    );

    if (idIssue) {
      issues.push(idIssue);
    }

    if (nameIssue) {
      issues.push(nameIssue);
    }

    if (addressIssue) {
      issues.push(addressIssue);
    }

    if (stop.timeWindow) {
      issues.push(...validateTimeWindow(`stops.${index}.timeWindow`, stop.timeWindow));
    }

    if (stop.priority && !validPriorities.has(stop.priority)) {
      issues.push({
        field: `stops.${index}.priority`,
        code: "INVALID_DELIVERY_PRIORITY",
        message: "Delivery priority is invalid.",
        severity: "invalid",
      });
    }

    if (stop.servicePolicy && !validServicePolicies.has(stop.servicePolicy)) {
      issues.push({
        field: `stops.${index}.servicePolicy`,
        code: "INVALID_SERVICE_POLICY",
        message: "Service policy is invalid.",
        severity: "invalid",
      });
    }
  });

  return issues;
}

function validateReturnToDepot(
  problem: RoutingProblem,
): RoutingValidationIssue[] {
  if (typeof problem.returnToDepot === "boolean") {
    return [];
  }

  return [
    {
      field: "returnToDepot",
      code: "MISSING_RETURN_TO_DEPOT",
      message: "Return-to-depot must be explicitly set.",
      severity: "missing",
    },
  ];
}

function validateStrategy(problem: RoutingProblem): RoutingValidationIssue[] {
  return validateOptimizationStrategy(
    getEffectiveOptimizationStrategy(problem),
  ).map((issue) => ({
    ...issue,
    severity:
      issue.code === "MISSING_OPTIMIZATION_STRATEGY"
        ? ("missing" as const)
        : ("invalid" as const),
  }));
}

function validateCapacity(problem: RoutingProblem): RoutingValidationIssue[] {
  const issues: RoutingValidationIssue[] = [];
  const hasDemand = hasCapacityConstraints(problem);
  const routeStops = routeStopsForProblem(problem);
  const dimensions = capacityDimensionsForDemand(problem, routeStops);

  if (!hasDemand) {
    return issues;
  }

  routeStops.forEach((stop, index) => {
    dimensions.forEach((dimension) => {
      const demand = stopDemandValue(stop, dimension.key);

      if (typeof demand !== "undefined" && !isValidNonNegativeNumber(demand)) {
        issues.push({
          field: `stops.${index}.demands.${dimension.key}`,
          code: "INVALID_STOP_DEMAND",
          message: "Stop demand must be a finite non-negative number.",
          severity: "invalid",
        });
      }
    });
  });

  dimensions.forEach((dimension) => {
    problem.vehicles.forEach((vehicle, index) => {
      const capacity = vehicleCapacityValue(vehicle, dimension.key);

      if (!isValidNonNegativeNumber(capacity)) {
        issues.push({
          field: `vehicles.${index}.capacities.${dimension.key}`,
          code: "INVALID_VEHICLE_CAPACITY",
          message: `Every vehicle must have a valid ${dimension.label.toLowerCase()} capacity when ${dimension.label.toLowerCase()} demand is used.`,
          severity: "invalid",
        });
      }
    });
  });

  if (issues.some((issue) => issue.code === "INVALID_VEHICLE_CAPACITY")) {
    return issues;
  }

  dimensions.forEach((dimension) => {
    const requiredDemand = routeStops.reduce(
      (sum, stop) =>
        (stop.servicePolicy ?? "required") === "required"
          ? sum + (stopDemandValue(stop, dimension.key) ?? 0)
          : sum,
      0,
    );
    const totalCapacity = problem.vehicles.reduce(
      (sum, vehicle) => sum + (vehicleCapacityValue(vehicle, dimension.key) ?? 0),
      0,
    );

    if (requiredDemand > totalCapacity) {
      issues.push({
        field: `capacity.${dimension.key}`,
        code: "TOTAL_DEMAND_EXCEEDS_CAPACITY",
        message: `Required ${dimension.label.toLowerCase()} demand exceeds total available vehicle capacity.`,
        severity: "invalid",
      });
    }
  });

  return issues;
}

function validateOperatingCosts(problem: RoutingProblem): RoutingValidationIssue[] {
  const issues: RoutingValidationIssue[] = [];

  if (problem.currency && !/^[A-Za-z]{3}$/.test(problem.currency)) {
    issues.push({
      field: "currency",
      code: "INVALID_CURRENCY",
      message: "Currency must be a three-letter ISO code.",
      severity: "invalid",
    });
  }

  problem.vehicles.forEach((vehicle, index) => {
    const cost = vehicle.operatingCost;

    if (!cost) {
      return;
    }

    const numericCostFields: [string, number | undefined][] = [
      ["fixedCost", cost.fixedCost],
      ["costPerKm", cost.costPerKm],
      ["costPerHour", cost.costPerHour],
      ["overtimeCostPerHour", cost.overtimeCostPerHour],
    ];

    numericCostFields.forEach(([field, value]) => {
      if (typeof value !== "undefined" && !isValidNonNegativeNumber(value)) {
        issues.push({
          field: `vehicles.${index}.operatingCost.${field}`,
          code: "INVALID_OPERATING_COST",
          message: "Vehicle operating costs must be finite non-negative numbers.",
          severity: "invalid",
        });
      }
    });

    if (
      typeof cost.overtimeAfterMinutes !== "undefined" &&
      !isValidNonNegativeNumber(cost.overtimeAfterMinutes)
    ) {
      issues.push({
        field: `vehicles.${index}.operatingCost.overtimeAfterMinutes`,
        code: "INVALID_OPERATING_COST",
        message: "Overtime threshold must be a finite non-negative number.",
        severity: "invalid",
      });
    }

    if (
      (typeof cost.overtimeAfterMinutes === "undefined") !==
      (typeof cost.overtimeCostPerHour === "undefined")
    ) {
      issues.push({
        field: `vehicles.${index}.operatingCost.overtime`,
        code: "INVALID_OPERATING_COST",
        message: "Overtime cost and threshold must be configured together.",
        severity: "invalid",
      });
    }
  });

  if (!strategyUsesOperatingCost(problem)) {
    return issues;
  }

  const vehiclesWithCost = problem.vehicles.filter((vehicle) => vehicle.operatingCost);
  const hasPositiveCost = problem.vehicles.some((vehicle) =>
    hasPositiveOperatingCost(vehicle.operatingCost),
  );

  if (vehiclesWithCost.length !== problem.vehicles.length || !hasPositiveCost) {
    issues.push({
      field: "vehicles.operatingCost",
      code: "OPERATING_COST_DATA_REQUIRED",
      message:
        "Operating-cost optimization requires costs for every vehicle and at least one positive cost value.",
      severity: "invalid",
    });
  }

  return issues;
}

function validateTimeWindow(
  field: string,
  timeWindow: TimeWindow,
): RoutingValidationIssue[] {
  const issues: RoutingValidationIssue[] = [];
  const startMinutes = parseTime(timeWindow.start);
  const endMinutes = parseTime(timeWindow.end);

  if (!timeWindow.start) {
    issues.push({
      field: `${field}.start`,
      code: "MISSING_TIME_WINDOW_START",
      message: "Time window start is required.",
      severity: "missing",
    });
  } else if (startMinutes === null) {
    issues.push({
      field: `${field}.start`,
      code: "INVALID_TIME_WINDOW_START",
      message: "Time window start must use HH:mm format.",
      severity: "invalid",
    });
  }

  if (!timeWindow.end) {
    issues.push({
      field: `${field}.end`,
      code: "MISSING_TIME_WINDOW_END",
      message: "Time window end is required.",
      severity: "missing",
    });
  } else if (endMinutes === null) {
    issues.push({
      field: `${field}.end`,
      code: "INVALID_TIME_WINDOW_END",
      message: "Time window end must use HH:mm format.",
      severity: "invalid",
    });
  }

  if (
    startMinutes !== null &&
    endMinutes !== null &&
    endMinutes <= startMinutes
  ) {
    issues.push({
      field,
      code: "INVALID_TIME_WINDOW_ORDER",
      message: "Time window end must be later than start.",
      severity: "invalid",
    });
  }

  if (timeWindow.mode && !["hard", "soft"].includes(timeWindow.mode)) {
    issues.push({
      field: `${field}.mode`,
      code: "INVALID_TIME_WINDOW_MODE",
      message: "Time window mode is invalid.",
      severity: "invalid",
    });
  }

  if (
    typeof timeWindow.maxLatenessMinutes !== "undefined" &&
    (!Number.isFinite(timeWindow.maxLatenessMinutes) ||
      timeWindow.maxLatenessMinutes < 0)
  ) {
    issues.push({
      field: `${field}.maxLatenessMinutes`,
      code: "INVALID_MAX_LATENESS",
      message: "Maximum lateness must be a non-negative number.",
      severity: "invalid",
    });
  }

  return issues;
}

function validateDuplicateIds(
  field: string,
  ids: string[],
  code: string,
  message: string,
): RoutingValidationIssue[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  ids.filter(Boolean).forEach((id) => {
    if (seen.has(id)) {
      duplicates.add(id);
    }

    seen.add(id);
  });

  return [...duplicates].map((id) => ({
    field,
    code,
    message: `${message} Duplicate value: ${id}.`,
    severity: "invalid" as const,
  }));
}

function requiredStringIssue(
  field: string,
  value: string | undefined,
  code: string,
  message: string,
) {
  if (typeof value === "string" && value.trim().length > 0) {
    return null;
  }

  return {
    field,
    code,
    message,
    severity: "missing" as const,
  };
}

function hasCapacityConstraints(problem: RoutingProblem) {
  const routeStops = routeStopsForProblem(problem);
  const dimensions = capacityDimensionsForDemand(problem, routeStops);

  return routeStops.some((stop) =>
    dimensions.some((dimension) => (stopDemandValue(stop, dimension.key) ?? 0) > 0),
  );
}

function capacityDimensionsForDemand(
  problem: RoutingProblem,
  routeStops = routeStopsForProblem(problem),
) {
  const dimensions = getCapacityConstraintDimensions(problem);
  const dimensionsWithDemand = dimensions.filter((dimension) =>
    routeStops.some((stop) => (stopDemandValue(stop, dimension.key) ?? 0) > 0),
  );

  if (dimensionsWithDemand.length > 0) {
    return dimensionsWithDemand;
  }

  if (routeStops.some((stop) => typeof stop.demand === "number" && stop.demand > 0)) {
    return ensureCapacityDimensions(dimensions, [defaultCapacityDimension]);
  }

  return dimensionsWithDemand;
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

function strategyUsesOperatingCost(problem: RoutingProblem) {
  const strategy = getEffectiveOptimizationStrategy(problem);

  return Boolean(
    strategy?.objectives.some(
      (objective) =>
        objective.enabled && objective.type === "minimize_operating_cost",
    ),
  );
}

function hasPositiveOperatingCost(
  cost: RoutingProblem["vehicles"][number]["operatingCost"],
) {
  if (!cost) {
    return false;
  }

  return [
    cost.fixedCost,
    cost.costPerKm,
    cost.costPerHour,
    cost.overtimeCostPerHour,
  ].some((value) => typeof value === "number" && Number.isFinite(value) && value > 0);
}

function isValidNonNegativeNumber(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function parseTime(value: string) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);

  if (!match) {
    return null;
  }

  return Number(match[1]) * 60 + Number(match[2]);
}
