import type { RoutingExtraction } from "@/lib/api/chat-types";
import type { ConversationPatchOperation } from "@/lib/api/chat-types";
import { builtInCapacityDimensions } from "@/lib/capacity";
import { operationsFromProblemPatch } from "@/lib/conversation-patch-operations";
import { createLocation } from "@/lib/locations";
import { strategyFromLegacyObjective } from "@/lib/optimization-strategy";
import { assessConversationReadiness } from "@/lib/conversation-readiness";
import type {
  DeliveryStop,
  RoutingJob,
  RoutingProblem,
  Vehicle,
} from "@/lib/types";

export function applyRoutingExtraction(
  problem: RoutingProblem,
  extraction: RoutingExtraction,
): RoutingProblem {
  if (extraction.operations && extraction.operations.length > 0) {
    return withDerivedStatus(
      applyConversationOperations(cloneProblemForPatch(problem), extraction.operations),
    );
  }

  const legacyOperations = operationsFromProblemPatch(extraction.problemPatch);

  if (legacyOperations.length > 0) {
    return withDerivedStatus(
      applyConversationOperations(cloneProblemForPatch(problem), legacyOperations),
    );
  }

  const patch = extraction.problemPatch;
  let nextProblem: RoutingProblem = cloneProblemForPatch(problem);

  if (patch.depot) {
    nextProblem = {
      ...nextProblem,
      depot: createLocation(patch.depot),
    };
  }

  if (typeof patch.vehicleCount === "number") {
    nextProblem = {
      ...nextProblem,
      vehicles: resizeVehicles(nextProblem.vehicles, patch.vehicleCount),
    };
  }

  if (patch.currency) {
    nextProblem = {
      ...nextProblem,
      currency: patch.currency.toUpperCase(),
    };
  }

  if (patch.capacityDimensions && patch.capacityDimensions.length > 0) {
    nextProblem = {
      ...nextProblem,
      capacityDimensions: mergeCapacityDimensions(
        nextProblem.capacityDimensions ?? [],
        patch.capacityDimensions,
      ),
    };
  }

  const vehiclePatches = patch.vehicles?.filter(
    (vehiclePatch) => !isMalformedVehicleName(vehiclePatch.name),
  );

  if (vehiclePatches && vehiclePatches.length > 0) {
    nextProblem = {
      ...nextProblem,
      capacityDimensions: mergeCapacityDimensions(
        nextProblem.capacityDimensions ?? [],
        inferCapacityDimensionsFromVehiclePatches(vehiclePatches),
      ),
      vehicles: mergeVehiclePatches(nextProblem.vehicles, vehiclePatches),
    };
  }

  if (typeof patch.returnToDepot === "boolean") {
    nextProblem = {
      ...nextProblem,
      returnToDepot: patch.returnToDepot,
    };
  }

  if (patch.optimizationStrategy) {
    nextProblem = {
      ...nextProblem,
      optimizationStrategy: patch.optimizationStrategy,
      objective: undefined,
    };
  }

  if (patch.objective) {
    nextProblem = {
      ...nextProblem,
      objective: patch.objective,
      optimizationStrategy: strategyFromLegacyObjective(patch.objective),
    };
  }

  if (patch.stops && patch.stops.length > 0) {
    nextProblem = applyStopPatches(nextProblem, patch.stops);
  }

  if (patch.jobs && patch.jobs.length > 0) {
    nextProblem = applyJobPatches(nextProblem, patch.jobs);
  }

  return withDerivedStatus(nextProblem);
}

function isMalformedVehicleName(name: string | undefined) {
  if (!name) {
    return false;
  }

  const normalized = name.toLowerCase();

  return (
    name.length > 80 ||
    name.includes("\n\n") ||
    /veicolo\s+\d+/i.test(name) ||
    normalized.includes("capacità") ||
    normalized.includes("capacita") ||
    normalized.includes("capacity:") ||
    normalized.includes("costi:") ||
    normalized.includes("costs:") ||
    normalized.includes("ottimizza")
  );
}

function cloneProblemForPatch(problem: RoutingProblem): RoutingProblem {
  return {
    ...problem,
    capacityDimensions: problem.capacityDimensions?.map((dimension) => ({
      ...dimension,
    })),
    vehicles: problem.vehicles.map((vehicle) => ({
      ...vehicle,
      capacities: vehicle.capacities ? { ...vehicle.capacities } : undefined,
      operatingCost: vehicle.operatingCost ? { ...vehicle.operatingCost } : undefined,
    })),
    stops: problem.stops.map((stop) => ({
      ...stop,
      demands: stop.demands ? { ...stop.demands } : undefined,
      timeWindow: stop.timeWindow ? { ...stop.timeWindow } : undefined,
    })),
    jobs: problem.jobs?.map((job) => ({ ...job })),
  };
}

function applyConversationOperations(
  problem: RoutingProblem,
  operations: ConversationPatchOperation[],
): RoutingProblem {
  return operations.reduce((nextProblem, operation) => {
    switch (operation.type) {
      case "SET_DEPOT":
        return { ...nextProblem, depot: createLocation(operation.address) };

      case "SET_RETURN_TO_DEPOT":
        return { ...nextProblem, returnToDepot: operation.returnToDepot };

      case "SET_CURRENCY":
        return { ...nextProblem, currency: operation.currency.toUpperCase() };

      case "SET_VEHICLE_COUNT":
        return {
          ...nextProblem,
          vehicles: resizeVehicles(nextProblem.vehicles, operation.count),
        };

      case "ADD_CAPACITY_DIMENSION":
        return {
          ...nextProblem,
          capacityDimensions: mergeCapacityDimensions(
            nextProblem.capacityDimensions ?? [],
            [operation.dimension],
          ),
        };

      case "REMOVE_CAPACITY_DIMENSION":
        return removeCapacityDimension(nextProblem, operation.dimensionKey);

      case "ADD_VEHICLE":
        if (isMalformedVehicleName(operation.vehicle.name)) {
          return nextProblem;
        }

        return addVehicleByOperation(nextProblem, operation.vehicle);

      case "UPDATE_VEHICLE":
        return updateVehicleByOperationTarget(
          nextProblem,
          operation.vehicleReference,
          operation.vehicleIndex,
          operation.patch,
        );

      case "RENAME_VEHICLE":
        return updateVehicleByOperationTarget(
          nextProblem,
          operation.vehicleReference,
          undefined,
          { name: operation.name },
        );

      case "REMOVE_VEHICLE":
        return {
          ...nextProblem,
          vehicles: nextProblem.vehicles.filter(
            (vehicle) =>
              normalizeName(vehicle.name) !== normalizeName(operation.vehicleReference) &&
              vehicle.id !== operation.vehicleReference,
          ),
        };

      case "SET_VEHICLE_CAPACITY":
        return updateVehicleByOperationTarget(
          ensureCapacityDimensionForKey(nextProblem, operation.dimensionKey, operation.unit),
          operation.vehicleReference,
          operation.vehicleIndex,
          { capacities: { [operation.dimensionKey]: operation.value } },
        );

      case "REMOVE_VEHICLE_CAPACITY":
        return {
          ...nextProblem,
          vehicles: nextProblem.vehicles.map((vehicle) => {
            if (!vehicleMatchesReference(vehicle, operation.vehicleReference)) {
              return vehicle;
            }

            const capacities = { ...(vehicle.capacities ?? {}) };
            delete capacities[operation.dimensionKey];

            return {
              ...vehicle,
              capacities: Object.keys(capacities).length > 0 ? capacities : undefined,
            };
          }),
        };

      case "SET_VEHICLE_OPERATING_COST":
        return updateVehicleByOperationTarget(
          nextProblem,
          operation.vehicleReference,
          operation.vehicleIndex,
          { operatingCost: operation.operatingCost },
        );

      case "SET_VEHICLE_WORK_LIMIT":
        return updateVehicleByOperationTarget(
          nextProblem,
          operation.vehicleReference,
          operation.vehicleIndex,
          {
            operatingCost: {
              overtimeAfterMinutes: operation.maxWorkingMinutes,
            },
          },
        );

      case "ADD_DELIVERY":
        return applyStopPatches(nextProblem, [operation.stop]);

      case "UPDATE_DELIVERY":
        return applyStopPatches(nextProblem, [
          {
            ...operation.patch,
            id: operation.stopId ?? operation.patch.id,
            name: operation.stopReference ?? operation.patch.name,
          },
        ]);

      case "REMOVE_DELIVERY":
        return {
          ...nextProblem,
          stops: nextProblem.stops.filter(
            (stop) =>
              stop.id !== operation.stopReference &&
              normalizeName(stop.name) !== normalizeName(operation.stopReference),
          ),
        };

      case "SET_STOP_DEMAND":
        return updateStopByOperationTarget(
          ensureCapacityDimensionForKey(nextProblem, operation.dimensionKey, operation.unit),
          operation.stopId,
          operation.stopReference,
          { demands: { [operation.dimensionKey]: operation.value } },
        );

      case "SET_STOP_SERVICE_TIME":
        return updateStopByOperationTarget(
          nextProblem,
          operation.stopId,
          operation.stopReference,
          { serviceTimeSeconds: operation.serviceTimeSeconds },
        );

      case "SET_STOP_TIME_WINDOW":
        return updateStopByOperationTarget(
          nextProblem,
          operation.stopId,
          operation.stopReference,
          { timeWindow: operation.timeWindow },
        );

      case "SET_STOP_SERVICE_POLICY":
        return updateStopByOperationTarget(
          nextProblem,
          operation.stopId,
          operation.stopReference,
          { servicePolicy: operation.servicePolicy },
        );

      case "SET_STOP_PRIORITY":
        return updateStopByOperationTarget(
          nextProblem,
          operation.stopId,
          operation.stopReference,
          { priority: operation.priority },
        );

      case "ADD_PICKUP_DELIVERY_JOB":
        return applyJobPatches(nextProblem, [operation.job]);

      case "UPDATE_PICKUP_DELIVERY_JOB":
        return applyJobPatches(nextProblem, [operation.patch]);

      case "REMOVE_PICKUP_DELIVERY_JOB":
        return {
          ...nextProblem,
          jobs: (nextProblem.jobs ?? []).filter(
            (job) =>
              job.id !== operation.jobReference &&
              normalizeName(job.id) !== normalizeName(operation.jobReference),
          ),
        };

      case "BULK_UPDATE_STOPS":
        return {
          ...nextProblem,
          stops: nextProblem.stops.map((stop) =>
            stopMatchesBulkSelector(stop, operation.selector)
              ? mergeStopPatch(stop, operation.patch)
              : stop,
          ),
        };

      case "BULK_UPDATE_VEHICLES":
        return {
          ...nextProblem,
          vehicles: nextProblem.vehicles.map((vehicle) =>
            mergeVehiclePatch(vehicle, operation.patch),
          ),
        };

      case "SET_STRATEGY_PRESET":
        return {
          ...nextProblem,
          optimizationStrategy: {
            mode: "preset",
            preset: operation.preset,
            objectives: [],
          },
          objective: undefined,
        };

      case "SET_STRATEGY_PRIORITY":
        return {
          ...nextProblem,
          optimizationStrategy: {
            mode: "priority",
            objectives: operation.objectives,
          },
          objective: undefined,
        };

      case "SET_STRATEGY_WEIGHTS":
        return {
          ...nextProblem,
          optimizationStrategy: {
            mode: "advanced",
            objectives: operation.objectives,
          },
          objective: undefined,
        };

      case "REQUEST_REVIEW":
      case "REQUEST_OPTIMIZATION":
      case "REQUEST_COMPARISON":
      case "SELECT_COMPARISON_PLAN":
      case "ASK_STATUS":
      case "EXPLAIN_CONCEPT":
      case "UNSUPPORTED_REQUEST":
        return nextProblem;

      default:
        return assertNeverOperation(operation);
    }
  }, problem);
}

function applyJobPatches(
  problem: RoutingProblem,
  jobPatches: NonNullable<RoutingExtraction["problemPatch"]["jobs"]>,
): RoutingProblem {
  const existingJobs = problem.jobs ?? [];
  const existingStops = allRouteStops(problem);
  const createdJobs: RoutingJob[] = [];

  jobPatches.forEach((jobPatch, index) => {
    if (jobPatch.type === "pickup_delivery" && jobPatch.pickupDelivery) {
      const sequence = existingStops.length + createdJobs.length * 2 + index + 1;
      createdJobs.push({
        id: jobPatch.id ?? createJobId([...existingJobs, ...createdJobs], sequence),
        type: "pickup_delivery",
        priority: jobPatch.priority ?? "normal",
        servicePolicy: jobPatch.servicePolicy ?? "required",
        pickupDelivery: {
          pickup: createStopFromPatch(
            jobPatch.pickupDelivery.pickup,
            [...existingStops, ...jobStops(createdJobs)],
            sequence,
          ),
          delivery: createStopFromPatch(
            jobPatch.pickupDelivery.delivery,
            [...existingStops, ...jobStops(createdJobs)],
            sequence + 1,
          ),
        },
      });
    }

    if (jobPatch.type === "delivery" && jobPatch.deliveryStop) {
      const sequence = existingStops.length + createdJobs.length + index + 1;
      createdJobs.push({
        id: jobPatch.id ?? createJobId([...existingJobs, ...createdJobs], sequence),
        type: "delivery",
        priority: jobPatch.priority ?? jobPatch.deliveryStop.priority ?? "normal",
        servicePolicy:
          jobPatch.servicePolicy ?? jobPatch.deliveryStop.servicePolicy ?? "required",
        deliveryStop: createStopFromPatch(
          jobPatch.deliveryStop,
          [...existingStops, ...jobStops(createdJobs)],
          sequence,
        ),
      });
    }
  });

  return {
    ...problem,
    jobs: [...existingJobs, ...createdJobs],
  };
}

function applyStopPatches(
  problem: RoutingProblem,
  stopPatches: NonNullable<RoutingExtraction["problemPatch"]["stops"]>,
): RoutingProblem {
  const createdStops: DeliveryStop[] = [];
  let stops = problem.stops.map((stop) => ({ ...stop }));

  stopPatches.forEach((stopPatch, index) => {
    const existingStopIndex = stopPatch.id
      ? stops.findIndex((stop) => stop.id === stopPatch.id)
      : findStopIndexByName(stops, stopPatch.name);

    if (existingStopIndex >= 0) {
      stops = stops.map((stop, stopIndex) =>
        stopIndex === existingStopIndex
          ? {
              ...stop,
              ...compactStopPatch(stopPatch),
              demands:
                stopPatch.demands || typeof stopPatch.demand === "number"
                  ? mergeCapacityValues(
                      stop.demands,
                      stopPatch.demands,
                      "load",
                      stopPatch.demand,
                    )
                  : stop.demands,
              timeWindow: mergeTimeWindow(stop.timeWindow, stopPatch.timeWindow),
            }
          : stop,
      );

      return;
    }

    createdStops.push(
      createStopFromPatch(
        stopPatch,
        [...stops, ...createdStops],
        problem.stops.length + createdStops.length + index + 1,
      ),
    );
  });

  return {
    ...problem,
    stops: [...stops, ...createdStops],
  };
}

function resizeVehicles(vehicles: Vehicle[], count: number): Vehicle[] {
  const safeCount = Math.max(1, Math.min(50, Math.floor(count)));
  const resizedVehicles: Vehicle[] = [];

  for (let index = 0; index < safeCount; index += 1) {
    const existingVehicle = vehicles[index];

    resizedVehicles.push(
      existingVehicle ?? {
        id: createVehicleId([...vehicles, ...resizedVehicles], index + 1),
        name: `Van ${index + 1}`,
      },
    );
  }

  return resizedVehicles;
}

function mergeVehiclePatches(
  currentVehicles: Vehicle[],
  vehiclePatches: NonNullable<RoutingExtraction["problemPatch"]["vehicles"]>,
): Vehicle[] {
  const currentByName = new Map(
    currentVehicles.map((vehicle) => [normalizeName(vehicle.name), vehicle]),
  );
  const shouldReplacePlaceholderFleet =
    vehiclePatches.length > 1 ||
    (currentVehicles.every(isPlaceholderVehicle) &&
      vehiclePatches.some(
        (vehiclePatch) => !isPlaceholderVehicleName(vehiclePatch.name),
      ));

  if (shouldReplacePlaceholderFleet) {
    const createdVehicles: Vehicle[] = [];

    return vehiclePatches.map((vehiclePatch, index) => {
      const existingByName = vehiclePatch.name
        ? currentByName.get(normalizeName(vehiclePatch.name))
        : undefined;
      const vehicle = existingByName ?? {
        id: createVehicleId([...currentVehicles, ...createdVehicles], index + 1),
        name: vehiclePatch.name ?? `Vehicle ${index + 1}`,
      };
      const mergedVehicle = mergeVehiclePatch(vehicle, vehiclePatch);

      createdVehicles.push(mergedVehicle);

      return mergedVehicle;
    });
  }

  const updatedVehicles = [...currentVehicles];

  vehiclePatches.forEach((vehiclePatch, index) => {
    const patchName = vehiclePatch.name;
    const existingIndex = patchName
      ? updatedVehicles.findIndex(
          (vehicle) => normalizeName(vehicle.name) === normalizeName(patchName),
        )
      : -1;
    const targetIndex = existingIndex >= 0 ? existingIndex : index;
    const vehicle = updatedVehicles[targetIndex] ?? {
      id: createVehicleId(updatedVehicles, targetIndex + 1),
      name: vehiclePatch.name ?? `Vehicle ${targetIndex + 1}`,
    };

    updatedVehicles[targetIndex] = mergeVehiclePatch(vehicle, vehiclePatch);
  });

  return updatedVehicles;
}

function mergeVehiclePatch(
  vehicle: Vehicle,
  vehiclePatch: NonNullable<RoutingExtraction["problemPatch"]["vehicles"]>[number],
): Vehicle {
  return {
    ...vehicle,
    name: vehiclePatch.name ?? vehicle.name,
    capacity: vehiclePatch.capacity ?? vehicle.capacity,
    capacities: mergeCapacityValues(
      vehicle.capacities,
      vehiclePatch.capacities,
      "load",
      vehiclePatch.capacity,
    ),
    operatingCost: vehiclePatch.operatingCost
      ? {
          ...vehicle.operatingCost,
          ...vehiclePatch.operatingCost,
        }
      : vehicle.operatingCost,
  };
}

function inferCapacityDimensionsFromVehiclePatches(
  vehiclePatches: NonNullable<RoutingExtraction["problemPatch"]["vehicles"]>,
) {
  const keys = new Set(
    vehiclePatches.flatMap((vehiclePatch) =>
      Object.keys(vehiclePatch.capacities ?? {}),
    ),
  );

  return builtInCapacityDimensions.filter((dimension) => keys.has(dimension.key));
}

function isPlaceholderVehicle(vehicle: Vehicle) {
  return isPlaceholderVehicleName(vehicle.name);
}

function isPlaceholderVehicleName(name: string | undefined) {
  return typeof name === "string" && /^van\s+\d+$/i.test(name.trim());
}

function createStopFromPatch(
  stopPatch: NonNullable<RoutingExtraction["problemPatch"]["stops"]>[number],
  existingStops: DeliveryStop[],
  sequence: number,
): DeliveryStop {
  const fallbackName = `Stop ${sequence}`;
  const name = stopPatch.name ?? stopPatch.address ?? fallbackName;
  const address = stopPatch.address ?? stopPatch.name ?? fallbackName;

  return {
    id: createStopId(existingStops, sequence),
    name,
    address,
    demand: stopPatch.demand,
    demands: mergeCapacityValues(
      undefined,
      stopPatch.demands,
      "load",
      stopPatch.demand,
    ),
    timeWindow: stopPatch.timeWindow
      ? { mode: "hard", ...stopPatch.timeWindow }
      : undefined,
    priority: stopPatch.priority ?? "normal",
    servicePolicy: stopPatch.servicePolicy ?? "required",
  };
}

function compactStopPatch(
  stopPatch: NonNullable<RoutingExtraction["problemPatch"]["stops"]>[number],
): Partial<DeliveryStop> {
  return {
    ...(stopPatch.name ? { name: stopPatch.name } : {}),
    ...(stopPatch.address ? { address: stopPatch.address } : {}),
    ...(typeof stopPatch.demand === "number" ? { demand: stopPatch.demand } : {}),
    ...(stopPatch.priority ? { priority: stopPatch.priority } : {}),
    ...(stopPatch.servicePolicy ? { servicePolicy: stopPatch.servicePolicy } : {}),
  };
}

function mergeStopPatch(
  stop: DeliveryStop,
  stopPatch: NonNullable<RoutingExtraction["problemPatch"]["stops"]>[number],
): DeliveryStop {
  return {
    ...stop,
    ...compactStopPatch(stopPatch),
    demands:
      stopPatch.demands || typeof stopPatch.demand === "number"
        ? mergeCapacityValues(stop.demands, stopPatch.demands, "load", stopPatch.demand)
        : stop.demands,
    timeWindow: mergeTimeWindow(stop.timeWindow, stopPatch.timeWindow),
    serviceTimeSeconds: stopPatch.serviceTimeSeconds ?? stop.serviceTimeSeconds,
  };
}

function updateVehicleByOperationTarget(
  problem: RoutingProblem,
  reference: string | undefined,
  index: number | undefined,
  patch: NonNullable<RoutingExtraction["problemPatch"]["vehicles"]>[number],
): RoutingProblem {
  const targetIndex = resolveVehicleIndex(problem.vehicles, reference, index);

  if (targetIndex === null) {
    return problem;
  }

  return {
    ...problem,
    capacityDimensions: mergeCapacityDimensions(
      problem.capacityDimensions ?? [],
      inferCapacityDimensionsFromVehiclePatches([patch]),
    ),
    vehicles: problem.vehicles.map((vehicle, vehicleIndex) =>
      vehicleIndex === targetIndex ? mergeVehiclePatch(vehicle, patch) : vehicle,
    ),
  };
}

function addVehicleByOperation(
  problem: RoutingProblem,
  patch: NonNullable<RoutingExtraction["problemPatch"]["vehicles"]>[number],
): RoutingProblem {
  const existingIndex = patch.name
    ? resolveVehicleIndex(problem.vehicles, patch.name, undefined)
    : null;
  const shouldReplaceSinglePlaceholder =
    existingIndex === null &&
    problem.vehicles.length === 1 &&
    isPlaceholderVehicle(problem.vehicles[0]);
  const nextVehicle =
    existingIndex !== null
      ? mergeVehiclePatch(problem.vehicles[existingIndex], patch)
      : mergeVehiclePatch(
          shouldReplaceSinglePlaceholder
            ? problem.vehicles[0]
            : {
                id: createVehicleId(problem.vehicles, problem.vehicles.length + 1),
                name: patch.name ?? `Vehicle ${problem.vehicles.length + 1}`,
              },
          patch,
        );

  return {
    ...problem,
    capacityDimensions: mergeCapacityDimensions(
      problem.capacityDimensions ?? [],
      inferCapacityDimensionsFromVehiclePatches([patch]),
    ),
    vehicles:
      existingIndex !== null
        ? problem.vehicles.map((vehicle, index) =>
            index === existingIndex ? nextVehicle : vehicle,
          )
        : shouldReplaceSinglePlaceholder
          ? [nextVehicle]
          : [...problem.vehicles, nextVehicle],
  };
}

function updateStopByOperationTarget(
  problem: RoutingProblem,
  stopId: string | undefined,
  reference: string | undefined,
  patch: Partial<DeliveryStop>,
): RoutingProblem {
  const targetIndex = resolveStopIndex(problem.stops, stopId, reference);

  if (targetIndex === null) {
    return problem;
  }

  return {
    ...problem,
    stops: problem.stops.map((stop, stopIndex) =>
      stopIndex === targetIndex
        ? {
            ...stop,
            ...patch,
            demands:
              patch.demands || typeof patch.demand === "number"
                ? mergeCapacityValues(stop.demands, patch.demands, "load", patch.demand)
                : stop.demands,
            timeWindow: patch.timeWindow
              ? mergeTimeWindow(stop.timeWindow, patch.timeWindow)
              : stop.timeWindow,
          }
        : stop,
    ),
  };
}

function resolveVehicleIndex(
  vehicles: Vehicle[],
  reference: string | undefined,
  index: number | undefined,
) {
  if (typeof index === "number" && index >= 0 && index < vehicles.length) {
    return index;
  }

  if (!reference) {
    return null;
  }

  const directIndex = vehicles.findIndex((vehicle) => vehicle.id === reference);

  if (directIndex >= 0) {
    return directIndex;
  }

  const normalizedReference = normalizeName(reference);
  const matchingIndexes = vehicles
    .map((vehicle, vehicleIndex) => ({ vehicle, vehicleIndex }))
    .filter(
      ({ vehicle }) => normalizeName(vehicle.name) === normalizedReference,
    )
    .map(({ vehicleIndex }) => vehicleIndex);

  return matchingIndexes.length === 1 ? matchingIndexes[0] : null;
}

function resolveStopIndex(
  stops: DeliveryStop[],
  stopId: string | undefined,
  reference: string | undefined,
) {
  if (stopId) {
    const idIndex = stops.findIndex((stop) => stop.id === stopId);

    if (idIndex >= 0) {
      return idIndex;
    }
  }

  if (!reference) {
    return null;
  }

  const normalizedReference = normalizeName(reference);
  const matchingIndexes = stops
    .map((stop, stopIndex) => ({ stop, stopIndex }))
    .filter(({ stop }) => normalizeName(stop.name) === normalizedReference)
    .map(({ stopIndex }) => stopIndex);

  return matchingIndexes.length === 1 ? matchingIndexes[0] : null;
}

function vehicleMatchesReference(vehicle: Vehicle, reference: string) {
  return vehicle.id === reference || normalizeName(vehicle.name) === normalizeName(reference);
}

function stopMatchesBulkSelector(
  stop: DeliveryStop,
  selector: "all" | "required" | "preferred" | "optional",
) {
  return selector === "all" || (stop.servicePolicy ?? "required") === selector;
}

function removeCapacityDimension(
  problem: RoutingProblem,
  dimensionKey: string,
): RoutingProblem {
  return {
    ...problem,
    capacityDimensions: (problem.capacityDimensions ?? []).filter(
      (dimension) => dimension.key !== dimensionKey,
    ),
    vehicles: problem.vehicles.map((vehicle) => ({
      ...vehicle,
      capacities: removeCapacityValue(vehicle.capacities, dimensionKey),
    })),
    stops: problem.stops.map((stop) => ({
      ...stop,
      demands: removeCapacityValue(stop.demands, dimensionKey),
    })),
  };
}

function removeCapacityValue(
  values: Record<string, number> | undefined,
  dimensionKey: string,
) {
  if (!values) {
    return undefined;
  }

  const nextValues = { ...values };
  delete nextValues[dimensionKey];

  return Object.keys(nextValues).length > 0 ? nextValues : undefined;
}

function ensureCapacityDimensionForKey(
  problem: RoutingProblem,
  dimensionKey: string,
  unit?: string,
): RoutingProblem {
  if ((problem.capacityDimensions ?? []).some((dimension) => dimension.key === dimensionKey)) {
    return problem;
  }

  const builtIn = builtInCapacityDimensions.find(
    (dimension) => dimension.key === dimensionKey,
  );

  return {
    ...problem,
    capacityDimensions: mergeCapacityDimensions(problem.capacityDimensions ?? [], [
      builtIn ?? {
        key: dimensionKey,
        label: humanizeDimensionKey(dimensionKey),
        unit: unit ?? "",
        valueType: "decimal",
      },
    ]),
  };
}

function humanizeDimensionKey(dimensionKey: string) {
  return dimensionKey
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function assertNeverOperation(operation: never): RoutingProblem {
  throw new Error(`Unsupported conversation operation: ${JSON.stringify(operation)}`);
}

function mergeCapacityDimensions(
  current: NonNullable<RoutingProblem["capacityDimensions"]>,
  patch: NonNullable<RoutingExtraction["problemPatch"]["capacityDimensions"]>,
) {
  const byKey = new Map(current.map((dimension) => [dimension.key, dimension]));

  patch.forEach((dimension) => {
    byKey.set(dimension.key, dimension);
  });

  return [...byKey.values()];
}

function mergeCapacityValues(
  current: Record<string, number> | undefined,
  patch: Record<string, number> | undefined,
  legacyKey: string,
  legacyValue?: number,
) {
  const merged = {
    ...(current ?? {}),
    ...(patch ?? {}),
  };

  if (typeof legacyValue === "number") {
    merged[legacyKey] = legacyValue;
  }

  return Object.keys(merged).length > 0 ? merged : undefined;
}

function mergeTimeWindow(
  current: DeliveryStop["timeWindow"],
  patch: DeliveryStop["timeWindow"],
) {
  if (!patch) {
    return current;
  }

  return {
    mode: "hard" as const,
    ...current,
    ...patch,
  };
}

function findStopIndexByName(stops: DeliveryStop[], name?: string) {
  if (!name) {
    return -1;
  }

  const normalizedName = normalizeName(name);

  return stops.findIndex((stop) => normalizeName(stop.name) === normalizedName);
}

function createVehicleId(vehicles: Vehicle[], sequence: number) {
  const existingIds = new Set(vehicles.map((vehicle) => vehicle.id));
  let nextSequence = sequence;
  let id = `vehicle-${nextSequence}`;

  while (existingIds.has(id)) {
    nextSequence += 1;
    id = `vehicle-${nextSequence}`;
  }

  return id;
}

function createStopId(stops: DeliveryStop[], sequence: number) {
  const existingIds = new Set(stops.map((stop) => stop.id));
  let nextSequence = sequence;
  let id = `stop-${nextSequence}`;

  while (existingIds.has(id)) {
    nextSequence += 1;
    id = `stop-${nextSequence}`;
  }

  return id;
}

function createJobId(jobs: RoutingJob[], sequence: number) {
  const existingIds = new Set(jobs.map((job) => job.id));
  let nextSequence = sequence;
  let id = `job-${nextSequence}`;

  while (existingIds.has(id)) {
    nextSequence += 1;
    id = `job-${nextSequence}`;
  }

  return id;
}

function allRouteStops(problem: RoutingProblem): DeliveryStop[] {
  return [...problem.stops, ...jobStops(problem.jobs ?? [])];
}

function jobStops(jobs: RoutingJob[]): DeliveryStop[] {
  return jobs.flatMap((job) => {
    if (job.type === "delivery" && job.deliveryStop) {
      return [job.deliveryStop];
    }

    if (job.type === "pickup_delivery" && job.pickupDelivery) {
      return [job.pickupDelivery.pickup, job.pickupDelivery.delivery];
    }

    return [];
  });
}

function normalizeName(value: string) {
  return value.trim().toLowerCase();
}

function withDerivedStatus(problem: RoutingProblem): RoutingProblem {
  if (problem.status === "failed") {
    return problem;
  }

  return {
    ...problem,
    status: assessConversationReadiness(problem).readyForReview
      ? "ready"
      : "collecting",
  };
}
