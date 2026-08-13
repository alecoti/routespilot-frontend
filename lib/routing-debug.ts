import type { RoutingExtraction } from "@/lib/api/chat-types";
import type { ImportedFileState } from "@/lib/conversation-types";
import type { RoutingProblem } from "@/lib/types";

type TracePayload = {
  conversationId?: string | null;
  extraction?: RoutingExtraction | null;
  importedFile?: ImportedFileState | null;
  note?: string;
  optimizationId?: string | null;
  problem?: RoutingProblem | null;
  revision?: number | null;
  traceId?: string | null;
  extra?: Record<string, unknown>;
};

let traceSequence = 0;

export function traceRoutingDebug(event: string, payload: TracePayload = {}) {
  if (!shouldTraceRoutingDebug()) {
    return;
  }

  traceSequence += 1;

  console.groupCollapsed(
    `%c[RoutesPilot Debug #${traceSequence}] ${event}`,
    "color:#0f766e;font-weight:700",
  );
  console.info("workspace", {
    conversationId: payload.conversationId ?? null,
    optimizationId: payload.optimizationId ?? null,
    problemId: payload.problem?.id ?? null,
    revision: payload.revision ?? null,
    traceId: payload.traceId ?? null,
  });

  if (payload.note) {
    console.info("note", payload.note);
  }

  if (payload.problem) {
    console.info("problem", summarizeProblem(payload.problem));
  }

  if (payload.importedFile) {
    console.info("importedFile", payload.importedFile);
  }

  if (payload.extraction) {
    console.info("extraction", {
      primaryIntent: payload.extraction.primaryIntent,
      confidence: payload.extraction.confidence,
      operations: payload.extraction.operations?.map((operation) => ({
        type: operation.type,
        vehicle:
          "vehicle" in operation && operation.vehicle
            ? operation.vehicle.name
            : undefined,
        stop:
          "stop" in operation && operation.stop
            ? operation.stop.name
            : undefined,
        preset: "preset" in operation ? operation.preset : undefined,
        objectives:
          "objectives" in operation
            ? operation.objectives?.map((objective) => objective.type)
            : undefined,
      })),
      problemPatch: payload.extraction.problemPatch,
    });
  }

  if (payload.extra) {
    console.info("extra", payload.extra);
  }

  console.groupEnd();
}

export function summarizeProblem(problem: RoutingProblem) {
  return {
    id: problem.id,
    name: problem.name,
    status: problem.status,
    depot: problem.depot?.address ?? null,
    stops: problem.stops.length,
    stopNames: problem.stops.slice(0, 8).map((stop) => stop.name),
    vehicles: problem.vehicles.length,
    vehicleDetails: problem.vehicles.map((vehicle) => ({
      id: vehicle.id,
      name: vehicle.name,
      capacity: vehicle.capacity,
      capacities: vehicle.capacities ?? null,
      operatingCost: vehicle.operatingCost ?? null,
    })),
    capacityDimensions: problem.capacityDimensions?.map((dimension) => ({
      key: dimension.key,
      label: dimension.label,
      unit: dimension.unit,
    })) ?? [],
    returnToDepot: problem.returnToDepot ?? null,
    strategy: problem.optimizationStrategy
      ? {
          mode: problem.optimizationStrategy.mode,
          preset: problem.optimizationStrategy.preset ?? null,
          objectives: problem.optimizationStrategy.objectives.map((objective) => ({
            type: objective.type,
            priority: objective.priority,
            weight: objective.weight,
            enabled: objective.enabled,
          })),
        }
      : null,
  };
}

function shouldTraceRoutingDebug() {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.NEXT_PUBLIC_CONVERSATION_DEBUG === "true" ||
    process.env.NEXT_PUBLIC_ROUTING_DEBUG === "true"
  );
}
