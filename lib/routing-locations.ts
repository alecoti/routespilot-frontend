import type { DeliveryStop, RouteStopRole, RoutingProblem } from "@/lib/types";

export type FrontendRouteLocation = DeliveryStop & {
  jobId?: string;
  role: RouteStopRole;
};

export function routeLocationsForProblem(
  problem: RoutingProblem,
): FrontendRouteLocation[] {
  return [
    ...problem.stops.map((stop) => ({
      ...stop,
      role: "delivery" as const,
    })),
    ...(problem.jobs ?? []).flatMap((job): FrontendRouteLocation[] => {
      if (job.type === "delivery" && job.deliveryStop) {
        return [
          {
            ...job.deliveryStop,
            jobId: job.id,
            role: "delivery",
            priority: job.priority ?? job.deliveryStop.priority,
            servicePolicy: job.servicePolicy ?? job.deliveryStop.servicePolicy,
          },
        ];
      }

      if (job.type === "pickup_delivery" && job.pickupDelivery) {
        return [
          {
            ...job.pickupDelivery.pickup,
            jobId: job.id,
            role: "pickup",
            priority: job.priority ?? job.pickupDelivery.pickup.priority,
            servicePolicy:
              job.servicePolicy ?? job.pickupDelivery.pickup.servicePolicy,
          },
          {
            ...job.pickupDelivery.delivery,
            jobId: job.id,
            role: "dropoff",
            priority: job.priority ?? job.pickupDelivery.delivery.priority,
            servicePolicy:
              job.servicePolicy ?? job.pickupDelivery.delivery.servicePolicy,
          },
        ];
      }

      return [];
    }),
  ];
}

export function routeLocationById(problem: RoutingProblem) {
  return new Map(
    routeLocationsForProblem(problem).map((location) => [
      location.id,
      location,
    ]),
  );
}

export function routeLocationCount(problem: RoutingProblem) {
  return routeLocationsForProblem(problem).length;
}

export function routeStopActionLabel(role?: RouteStopRole) {
  if (role === "pickup") {
    return "Pick up";
  }

  if (role === "dropoff") {
    return "Deliver";
  }

  return "Delivery";
}
