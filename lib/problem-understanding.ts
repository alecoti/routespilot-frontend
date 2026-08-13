import {
  getCapacityConstraintDimensions,
  stopDemandValue,
} from "@/lib/capacity";
import type {
  CapacityDimensionDefinition,
  DeliveryStop,
  RoutingProblem,
} from "@/lib/types";

export type ProblemUnderstanding = {
  problemType:
    | "unknown"
    | "single_delivery"
    | "multi_stop_delivery"
    | "pickup_delivery";
  activeConstraints: {
    capacity: boolean;
    capacityDimensions: CapacityDimensionDefinition[];
    timeWindows: boolean;
    serviceTimes: boolean;
    operatingCost: boolean;
    pickupDelivery: boolean;
    returnToDepotKnown: boolean;
  };
  counts: {
    deliveries: number;
    jobs: number;
    vehicles: number;
  };
};

export function inferProblemUnderstanding(
  problem: RoutingProblem,
): ProblemUnderstanding {
  const routeStops = routeStopsForProblem(problem);
  const activeCapacityDimensions = getActiveCapacityDimensions(problem, routeStops);
  const pickupDelivery = Boolean(
    problem.jobs?.some((job) => job.type === "pickup_delivery"),
  );

  return {
    problemType: pickupDelivery
      ? "pickup_delivery"
      : routeStops.length > 1
        ? "multi_stop_delivery"
        : routeStops.length === 1
          ? "single_delivery"
          : "unknown",
    activeConstraints: {
      capacity: activeCapacityDimensions.length > 0,
      capacityDimensions: activeCapacityDimensions,
      timeWindows: routeStops.some((stop) => Boolean(stop.timeWindow)),
      serviceTimes: routeStops.some(
        (stop) =>
          typeof stop.serviceTimeSeconds === "number" &&
          stop.serviceTimeSeconds > 0,
      ),
      operatingCost: problem.vehicles.some((vehicle) =>
        Boolean(vehicle.operatingCost),
      ),
      pickupDelivery,
      returnToDepotKnown: typeof problem.returnToDepot === "boolean",
    },
    counts: {
      deliveries: problem.stops.length,
      jobs: problem.jobs?.length ?? 0,
      vehicles: problem.vehicles.length,
    },
  };
}

export function getActiveCapacityDimensions(
  problem: RoutingProblem,
  routeStops = routeStopsForProblem(problem),
): CapacityDimensionDefinition[] {
  return getCapacityConstraintDimensions(problem).filter((dimension) =>
    routeStops.some((stop) => (stopDemandValue(stop, dimension.key) ?? 0) > 0),
  );
}

export function routeStopsForProblem(problem: RoutingProblem): DeliveryStop[] {
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
