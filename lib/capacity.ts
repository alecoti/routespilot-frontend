import type {
  CapacityDimensionDefinition,
  CapacityValues,
  DeliveryStop,
  RoutingProblem,
  Vehicle,
  VehicleRouteResult,
} from "@/lib/types";

export const defaultCapacityDimension: CapacityDimensionDefinition = {
  key: "weight",
  label: "Weight",
  unit: "kg",
  valueType: "decimal",
};

export const legacyLoadCapacityDimension: CapacityDimensionDefinition = {
  key: "load",
  label: "Load",
  unit: "kg",
  valueType: "decimal",
};

export const builtInCapacityDimensions: CapacityDimensionDefinition[] = [
  defaultCapacityDimension,
  legacyLoadCapacityDimension,
  {
    key: "volume",
    label: "Volume",
    unit: "m3",
    valueType: "decimal",
  },
  {
    key: "pallets",
    label: "Pallets",
    unit: "pallets",
    valueType: "integer",
  },
  {
    key: "packages",
    label: "Packages",
    unit: "pcs",
    valueType: "integer",
  },
];

export function getCapacityDimensions(
  problem: RoutingProblem,
): CapacityDimensionDefinition[] {
  const dimensions = problem.capacityDimensions ?? [];
  const hasModernDimensions = dimensions.some(
    (dimension) => dimension.key !== legacyLoadCapacityDimension.key,
  );
  const usesLegacyCapacity =
    problem.vehicles.some((vehicle) => typeof vehicle.capacity === "number") ||
    problem.stops.some((stop) => typeof stop.demand === "number");

  if (
    !hasModernDimensions &&
    usesLegacyCapacity &&
    !dimensions.some((dimension) => dimension.key === legacyLoadCapacityDimension.key)
  ) {
    return [legacyLoadCapacityDimension, ...dimensions];
  }

  return dimensions;
}

export type CapacityUsageSummary = {
  dimension: CapacityDimensionDefinition;
  requiredDemand: number;
  totalCapacity: number;
  totalDemand: number;
};

export function getCapacityConstraintDimensions(
  problem: RoutingProblem,
): CapacityDimensionDefinition[] {
  const dimensions = getCapacityDimensions(problem);
  const hasWeightDimension = dimensions.some((dimension) => dimension.key === "weight");
  const hasLoadDimension = dimensions.some((dimension) => dimension.key === "load");
  const hasWeightDemand = routeStopsForCapacity(problem).some(
    (stop) => (stopDemandValue(stop, "weight") ?? 0) > 0,
  );

  if (hasWeightDimension && hasLoadDimension && hasWeightDemand) {
    return dimensions.filter((dimension) => dimension.key !== "load");
  }

  return dimensions;
}

export function summarizeCapacityUsage(
  problem: RoutingProblem,
): CapacityUsageSummary[] {
  const routeStops = routeStopsForCapacity(problem);

  return getCapacityConstraintDimensions(problem)
    .map((dimension) => {
      const totalDemand = routeStops.reduce(
        (sum, stop) => sum + (stopDemandValue(stop, dimension.key) ?? 0),
        0,
      );
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

      return {
        dimension,
        requiredDemand,
        totalCapacity,
        totalDemand,
      };
    })
    .filter(
      (item) =>
        item.totalDemand > 0 ||
        item.requiredDemand > 0 ||
        item.totalCapacity > 0,
    );
}

export function vehicleCapacityValue(
  vehicle: Vehicle,
  key: string,
): number | undefined {
  if (typeof vehicle.capacities?.[key] === "number") {
    return vehicle.capacities[key];
  }

  if ((key === "load" || key === "weight") && typeof vehicle.capacity === "number") {
    return vehicle.capacity;
  }

  if (key === "weight" && typeof vehicle.capacities?.load === "number") {
    return vehicle.capacities.load;
  }

  return undefined;
}

export function stopDemandValue(
  stop: DeliveryStop,
  key: string,
): number | undefined {
  if (typeof stop.demands?.[key] === "number") {
    return stop.demands[key];
  }

  if ((key === "load" || key === "weight") && typeof stop.demand === "number") {
    return stop.demand;
  }

  if (key === "weight" && typeof stop.demands?.load === "number") {
    return stop.demands.load;
  }

  return undefined;
}

export function withVehicleCapacity(
  vehicle: Vehicle,
  key: string,
  value: number | undefined,
): Vehicle {
  const capacities = updateCapacityValues(vehicle.capacities, key, value);

  return {
    ...vehicle,
    capacities,
    ...(key === "load" ? { capacity: value } : {}),
  };
}

export function withStopDemand(
  stop: DeliveryStop,
  key: string,
  value: number | undefined,
): DeliveryStop {
  const demands = updateCapacityValues(stop.demands, key, value);

  return {
    ...stop,
    demands,
    ...(key === "load" ? { demand: value } : {}),
  };
}

export function ensureCapacityDimensions(
  currentDimensions: CapacityDimensionDefinition[] | undefined,
  requiredDimensions: CapacityDimensionDefinition[],
): CapacityDimensionDefinition[] {
  const byKey = new Map<string, CapacityDimensionDefinition>();

  [...(currentDimensions ?? []), ...requiredDimensions].forEach((dimension) => {
    byKey.set(dimension.key, dimension);
  });

  return [...byKey.values()];
}

export function formatCapacityValue(
  value: number | undefined,
  definition: CapacityDimensionDefinition,
) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "";
  }

  const formatted = Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, "");

  return `${formatted} ${definition.unit}`.trim();
}

export function formatStopDemands(
  stop: DeliveryStop,
  dimensions: CapacityDimensionDefinition[],
) {
  const values = dimensions
    .map((dimension) => formatCapacityValue(stopDemandValue(stop, dimension.key), dimension))
    .filter(Boolean);

  return values.length > 0 ? values.join(" | ") : "-";
}

export function formatRouteCapacityUsage(
  route: VehicleRouteResult,
  vehicle: Vehicle | undefined,
  dimensions: CapacityDimensionDefinition[],
) {
  if (route.capacityUsage && Object.keys(route.capacityUsage).length > 0) {
    const values = dimensions
      .map((dimension) => {
        const usage = route.capacityUsage?.[dimension.key];

        if (!usage) {
          return "";
        }

        return `${formatNumber(usage.used)} / ${formatNumber(usage.capacity)} ${usage.unit}`.trim();
      })
      .filter(Boolean);

    if (values.length > 0) {
      return values.join(" | ");
    }
  }

  if (typeof route.totalLoad === "number" || typeof vehicle?.capacity === "number") {
    return `${route.totalLoad ?? 0}/${vehicle?.capacity ?? "-"} kg`;
  }

  return "Load not set";
}

export function maxCapacityUsagePercent(
  route: VehicleRouteResult,
  vehicle: Vehicle | undefined,
  dimensions: CapacityDimensionDefinition[],
) {
  if (route.capacityUsage && Object.keys(route.capacityUsage).length > 0) {
    const percents = dimensions
      .map((dimension) => route.capacityUsage?.[dimension.key])
      .filter((usage): usage is NonNullable<typeof usage> => Boolean(usage))
      .map((usage) =>
        usage.capacity > 0 ? Math.round((usage.used / usage.capacity) * 100) : 0,
      );

    return percents.length > 0 ? Math.max(...percents) : undefined;
  }

  if (!vehicle?.capacity || !route.totalLoad) {
    return undefined;
  }

  return Math.round((route.totalLoad / vehicle.capacity) * 100);
}

function updateCapacityValues(
  values: CapacityValues | undefined,
  key: string,
  value: number | undefined,
): CapacityValues | undefined {
  const nextValues = { ...(values ?? {}) };

  if (typeof value === "number" && Number.isFinite(value)) {
    nextValues[key] = value;
  } else {
    delete nextValues[key];
  }

  return Object.keys(nextValues).length > 0 ? nextValues : undefined;
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, "");
}

function routeStopsForCapacity(problem: RoutingProblem): DeliveryStop[] {
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
