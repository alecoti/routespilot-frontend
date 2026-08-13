import type {
  ConversationPatchOperation,
  RoutingProblemPatch,
} from "@/lib/api/chat-types";

export function operationsFromProblemPatch(
  patch: RoutingProblemPatch,
): ConversationPatchOperation[] {
  const operations: ConversationPatchOperation[] = [];

  if (patch.depot) {
    operations.push({ type: "SET_DEPOT", address: patch.depot });
  }

  if (patch.currency) {
    operations.push({ type: "SET_CURRENCY", currency: patch.currency });
  }

  if (typeof patch.vehicleCount === "number" && !patch.vehicles?.length) {
    operations.push({ type: "SET_VEHICLE_COUNT", count: patch.vehicleCount });
  }

  patch.capacityDimensions?.forEach((dimension) => {
    operations.push({ type: "ADD_CAPACITY_DIMENSION", dimension });
  });

  patch.vehicles?.forEach((vehicle, index) => {
    operations.push(
      vehicle.name
        ? { type: "ADD_VEHICLE", vehicle }
        : { type: "UPDATE_VEHICLE", vehicleIndex: index, patch: vehicle },
    );
  });

  if (typeof patch.returnToDepot === "boolean") {
    operations.push({
      type: "SET_RETURN_TO_DEPOT",
      returnToDepot: patch.returnToDepot,
    });
  }

  if (patch.optimizationStrategy) {
    if (
      patch.optimizationStrategy.mode === "preset" &&
      patch.optimizationStrategy.preset
    ) {
      operations.push({
        type: "SET_STRATEGY_PRESET",
        preset: patch.optimizationStrategy.preset,
      });
    } else if (patch.optimizationStrategy.mode === "priority") {
      operations.push({
        type: "SET_STRATEGY_PRIORITY",
        objectives: patch.optimizationStrategy.objectives,
      });
    } else if (patch.optimizationStrategy.mode === "advanced") {
      operations.push({
        type: "SET_STRATEGY_WEIGHTS",
        objectives: patch.optimizationStrategy.objectives,
      });
    }
  }

  patch.stops?.forEach((stop) => {
    operations.push(
      stop.id
        ? { type: "UPDATE_DELIVERY", stopId: stop.id, patch: stop }
        : { type: "ADD_DELIVERY", stop },
    );
  });

  patch.jobs?.forEach((job) => {
    if (job.type === "pickup_delivery") {
      operations.push({ type: "ADD_PICKUP_DELIVERY_JOB", job });
    } else if (job.deliveryStop) {
      operations.push({ type: "ADD_DELIVERY", stop: job.deliveryStop });
    }
  });

  return operations;
}
