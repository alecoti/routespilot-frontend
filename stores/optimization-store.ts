import { createStore } from "zustand/vanilla";

import {
  applyRoutingExtraction as applyRoutingExtractionToProblem,
} from "@/lib/apply-routing-extraction";
import {
  applyConversationAnswer,
  deriveConversationAction,
  formatConversationAnswer,
  getNextQuestion,
} from "@/lib/conversation-engine";
import type {
  ConversationAnswer,
  ConversationAction,
  ConversationMessage,
  ConversationQuestion,
  ImportedFileState,
} from "@/lib/conversation-types";
import type { RoutingExtraction } from "@/lib/api/chat-types";
import { getCapacityDimensions, vehicleCapacityValue } from "@/lib/capacity";
import { createLocation } from "@/lib/locations";
import { validateRoutingProblem } from "@/lib/routing-validation";
import {
  clearOptimizationArtifacts,
  patchInvalidatesOptimization,
} from "@/lib/optimization-invalidation";
import { strategyFromLegacyObjective } from "@/lib/optimization-strategy";
import { traceRoutingDebug } from "@/lib/routing-debug";
import type {
  ComparativePlan,
  DeliveryStop,
  GeoLocation,
  InfeasibilityDiagnostics,
  OptimizationObjective,
  OptimizationDebugTiming,
  OptimizationStrategy,
  RouteGeometryError,
  RoutingProblem,
  RoutingResult,
  Vehicle,
  VehicleRouteGeometry,
} from "@/lib/types";

export type OptimizationClientStatus =
  | "idle"
  | "optimizing"
  | "completed"
  | "failed";

export type ComparisonClientStatus =
  | "idle"
  | "comparing"
  | "completed"
  | "failed";

export type OptimizationState = {
  comparisonError: string | null;
  comparisonPlans: ComparativePlan[];
  comparisonStatus: ComparisonClientStatus;
  conversationRevision: number;
  conversationSessionId: string;
  importedFile: ImportedFileState | null;
  isInterpretingMessage: boolean;
  lastConversationAction: ConversationAction | null;
  messages: ConversationMessage[];
  optimizationError: string | null;
  optimizationDebugTiming: OptimizationDebugTiming | null;
  optimizationId: string | null;
  optimizationStatus: OptimizationClientStatus;
  problem: RoutingProblem;
  result: RoutingResult | null;
  diagnostics: InfeasibilityDiagnostics | null;
  routeGeometries: VehicleRouteGeometry[];
  routeGeometryError: RouteGeometryError | null;
  recommendedComparisonPlanId: string | null;
};

export type OptimizationActions = {
  addAssistantConversationMessage: (content: string) => void;
  addStop: (stop: DeliveryStop) => void;
  addUserConversationMessage: (
    content: string,
    currentQuestion?: ConversationQuestion | null,
  ) => void;
  addVehicle: (vehicle: Vehicle) => void;
  answerConversationQuestion: (
    question: ConversationQuestion,
    answer: ConversationAnswer,
  ) => void;
  applyRoutingExtraction: (
    extraction: RoutingExtraction,
    options?: ConversationMutationTraceOptions,
  ) => void;
  applyComparisonPlan: (plan: ComparativePlan) => void;
  clearComparison: () => void;
  clearImportedFileState: () => void;
  removeStop: (stopId: string) => void;
  removeVehicle: (vehicleId: string) => void;
  resetOptimization: () => void;
  setComparisonError: (error: string | null) => void;
  setComparisonResult: (
    plans: ComparativePlan[],
    recommendedPlanId?: string | null,
  ) => void;
  setComparisonStatus: (status: ComparisonClientStatus) => void;
  setConversationPending: (isPending: boolean) => void;
  setDepot: (depot?: string) => void;
  setDiagnostics: (diagnostics: InfeasibilityDiagnostics | null) => void;
  setOptimizationError: (error: string | null) => void;
  setOptimizationDebugTiming: (timing: OptimizationDebugTiming | null) => void;
  setOptimizationId: (optimizationId: string | null) => void;
  setOptimizationStatus: (status: OptimizationClientStatus) => void;
  setImportedFileState: (importedFile: ImportedFileState | null) => void;
  startNewOptimization: (payload?: {
    conversationSessionId?: string;
    messages?: ConversationMessage[];
    optimizationId?: string | null;
    problem?: RoutingProblem;
  }) => void;
  setObjective: (objective?: OptimizationObjective) => void;
  setOptimizationStrategy: (strategy?: OptimizationStrategy) => void;
  setProblem: (
    problem: RoutingProblem,
    options?: { conversationRevision?: number },
  ) => void;
  setResult: (result: RoutingResult | null) => void;
  setReturnToDepot: (returnToDepot: boolean) => void;
  setRouteGeometries: (routeGeometries: VehicleRouteGeometry[]) => void;
  setRouteGeometryError: (error: RouteGeometryError | null) => void;
  setStops: (stops: DeliveryStop[]) => void;
  setVehicles: (vehicles: Vehicle[]) => void;
  updateProblem: (patch: Partial<RoutingProblem>) => void;
  updateDepot: (patch: Partial<GeoLocation>) => void;
  updateStop: (stopId: string, patch: Partial<DeliveryStop>) => void;
  updateVehicle: (vehicleId: string, patch: Partial<Vehicle>) => void;
  hydrateConversation: (payload: {
    conversationSessionId: string;
    messages: ConversationMessage[];
    optimizationId?: string | null;
    problem?: RoutingProblem;
    revision?: number;
  }) => void;
  setConversationSessionId: (conversationSessionId: string) => void;
};

export type OptimizationStore = OptimizationState & OptimizationActions;

export type OptimizationStoreApi = ReturnType<typeof createOptimizationStore>;

export type ConversationMutationTraceOptions = {
  traceId?: string;
  stateRevision?: number;
};

export const initialRoutingProblem: RoutingProblem = {
  id: "draft-routing-problem",
  name: "New optimization",
  vehicles: [],
  stops: [],
  jobs: [],
  currency: "EUR",
  returnToDepot: true,
  status: "collecting",
};

const initialConversationMessages: ConversationMessage[] = [
  {
    id: "conversation-message-welcome",
    role: "assistant",
    content:
      "Ciao. Carica un file con le consegne oppure descrivimi direttamente il piano da organizzare.",
  },
];

export const defaultOptimizationState: OptimizationState =
  createDefaultOptimizationState();

export function createOptimizationStore(
  initialState: OptimizationState = defaultOptimizationState,
) {
  return createStore<OptimizationStore>()((set) => ({
    ...initialState,
    addAssistantConversationMessage: (content) =>
      set((state) => ({
        messages: [
          ...state.messages,
          createConversationMessage("assistant", content),
        ],
      })),
    addStop: (stop) =>
      set((state) => {
        const problem = {
          ...state.problem,
          stops: [...state.problem.stops, stop],
        };

        return {
          problem,
          ...advanceConversation(state, problem),
          ...clearOptimizationArtifactsForState(state),
        };
      }),
    addUserConversationMessage: (content) =>
      set((state) => ({
        messages: [...state.messages, createConversationMessage("user", content)],
      })),
    addVehicle: (vehicle) =>
      set((state) => {
        const problem = {
          ...state.problem,
          vehicles: [...state.problem.vehicles, vehicle],
        };

        return {
          problem,
          ...advanceConversation(state, problem),
          ...clearOptimizationArtifactsForState(state),
        };
      }),
    answerConversationQuestion: (question, answer) =>
      set((state) => {
        const assistantMessages =
          state.messages.at(-1)?.content === question.message
            ? state.messages
            : [
                ...state.messages,
                createConversationMessage("assistant", question.message),
              ];
        const nextProblem = applyConversationAnswer(
          state.problem,
          question,
          answer,
        );

        return {
          messages: [
            ...assistantMessages,
            createConversationMessage(
              "user",
              formatConversationAnswer(question, answer),
            ),
          ],
          ...advanceConversation(state, nextProblem),
          problem: nextProblem,
          result: null,
          diagnostics: null,
          routeGeometries: [],
          routeGeometryError: null,
          optimizationError: null,
          optimizationId: draftOptimizationIdForState(state),
          optimizationStatus: "idle",
          isInterpretingMessage: false,
        };
      }),
    applyRoutingExtraction: (extraction, options) =>
      set((state) => {
        if (
          typeof options?.stateRevision === "number" &&
          options.stateRevision !== state.conversationRevision
        ) {
          traceStaleConversationMutation({
            currentRevision: state.conversationRevision,
            extraction,
            options,
          });

          return {};
        }

        const nextProblem = applyRoutingExtractionToProblem(
          state.problem,
          extraction,
        );

        traceConversationMutation({
          after: nextProblem,
          before: state.problem,
          extraction,
          options,
        });
        traceRoutingDebug("STORE_APPLY_ROUTING_EXTRACTION", {
          conversationId: state.conversationSessionId,
          extraction,
          optimizationId: state.optimizationId,
          problem: nextProblem,
          revision: state.conversationRevision + 1,
          traceId: options?.traceId,
        });

        return {
          ...advanceConversation(state, nextProblem),
          problem: nextProblem,
          result: null,
          diagnostics: null,
          routeGeometries: [],
          routeGeometryError: null,
          optimizationError: null,
          optimizationId: draftOptimizationIdForState(state),
          optimizationStatus: "idle",
        };
      }),
    applyComparisonPlan: (plan) =>
      set((state) => {
        if (!plan.result) {
          return {};
        }

        return {
          problem: {
            ...state.problem,
            objective: undefined,
            optimizationStrategy: cloneOptimizationStrategy(plan.strategy),
            status: "completed",
          },
          result: plan.result,
          diagnostics: null,
          routeGeometries: [],
          routeGeometryError: null,
          optimizationError: null,
          optimizationStatus: "completed",
        };
      }),
    clearComparison: () =>
      set({
        comparisonError: null,
        comparisonPlans: [],
        comparisonStatus: "idle",
        recommendedComparisonPlanId: null,
      }),
    clearImportedFileState: () => set({ importedFile: null }),
    removeStop: (stopId) =>
      set((state) => {
        const problem = {
          ...state.problem,
          stops: state.problem.stops.filter((stop) => stop.id !== stopId),
        };

        return {
          problem,
          ...advanceConversation(state, problem),
          ...clearOptimizationArtifactsForState(state),
        };
      }),
    removeVehicle: (vehicleId) =>
      set((state) => {
        const problem = {
          ...state.problem,
          vehicles: state.problem.vehicles.filter(
            (vehicle) => vehicle.id !== vehicleId,
          ),
        };

        return {
          problem,
          ...advanceConversation(state, problem),
          ...clearOptimizationArtifactsForState(state),
        };
      }),
    resetOptimization: () => {
      clearPersistedConversationId();
      set(createDefaultOptimizationState());
    },
    setComparisonError: (error) => set({ comparisonError: error }),
    setComparisonResult: (plans, recommendedPlanId) =>
      set({
        comparisonError: null,
        comparisonPlans: plans,
        comparisonStatus: "completed",
        recommendedComparisonPlanId: recommendedPlanId ?? null,
      }),
    setComparisonStatus: (status) => set({ comparisonStatus: status }),
    setConversationPending: (isPending) =>
      set({ isInterpretingMessage: isPending }),
    hydrateConversation: ({
      conversationSessionId,
      messages,
      optimizationId,
      problem,
      revision,
    }) =>
      set((state) => {
        const nextProblem = problem
          ? withMigratedOptimizationStrategy(problem)
          : state.problem;
        const conversationRevision =
          typeof revision === "number" ? revision : state.conversationRevision;
        traceRoutingDebug("STORE_HYDRATE_CONVERSATION", {
          conversationId: conversationSessionId,
          optimizationId: optimizationId ?? state.optimizationId,
          problem: nextProblem,
          revision: conversationRevision,
          extra: {
            incomingHasProblem: Boolean(problem),
            incomingMessages: messages.length,
            incomingRevision: revision ?? null,
            previousConversationId: state.conversationSessionId,
            previousOptimizationId: state.optimizationId,
            previousStopCount: state.problem.stops.length,
            previousVehicleCount: state.problem.vehicles.length,
          },
        });

        return {
          conversationRevision,
          conversationSessionId,
          messages: messages.length > 0 ? messages : state.messages,
          optimizationId: optimizationId ?? state.optimizationId,
          problem: nextProblem,
          lastConversationAction: deriveConversationAction(nextProblem),
        };
      }),
    setConversationSessionId: (conversationSessionId) =>
      set({ conversationSessionId }),
    setDepot: (depot) =>
      set((state) => {
        const problem = {
          ...state.problem,
          depot: depot ? createLocation(depot) : undefined,
        };

        return {
          problem,
          ...advanceConversation(state, problem),
          ...clearOptimizationArtifactsForState(state),
        };
      }),
    setDiagnostics: (diagnostics) => set({ diagnostics }),
    setOptimizationError: (error) => set({ optimizationError: error }),
    setOptimizationDebugTiming: (timing) =>
      set({ optimizationDebugTiming: timing }),
    setOptimizationId: (optimizationId) => set({ optimizationId }),
    setOptimizationStatus: (status) => set({ optimizationStatus: status }),
    setImportedFileState: (importedFile) => set({ importedFile }),
    startNewOptimization: (payload) =>
      set(() => {
        const nextState = createDefaultOptimizationState({
          conversationSessionId: payload?.conversationSessionId,
          messages: payload?.messages,
          optimizationId: payload?.optimizationId,
          problem: payload?.problem,
        });

        traceRoutingDebug("STORE_START_NEW_OPTIMIZATION", {
          conversationId: nextState.conversationSessionId,
          optimizationId: nextState.optimizationId,
          problem: nextState.problem,
          revision: nextState.conversationRevision,
        });

        return nextState;
      }),
    setObjective: (objective) =>
      set((state) => {
        const problem = {
          ...state.problem,
          objective,
          optimizationStrategy: strategyFromLegacyObjective(objective),
        };

        return {
          problem,
          ...advanceConversation(state, problem),
          ...clearOptimizationArtifactsForState(state),
        };
      }),
    setOptimizationStrategy: (strategy) =>
      set((state) => {
        const problem = {
          ...state.problem,
          optimizationStrategy: strategy,
          objective: undefined,
        };

        return {
          problem,
          ...advanceConversation(state, problem),
          ...clearOptimizationArtifactsForState(state),
        };
      }),
    setProblem: (problem, options) =>
      set((state) => {
        const nextProblem = withMigratedOptimizationStrategy(problem);
        const conversationRevision =
          typeof options?.conversationRevision === "number"
            ? options.conversationRevision
            : state.conversationRevision + 1;
        traceRoutingDebug("STORE_SET_PROBLEM", {
          conversationId: state.conversationSessionId,
          optimizationId: state.optimizationId,
          problem: nextProblem,
          revision: conversationRevision,
          extra: {
            incomingConversationRevision: options?.conversationRevision ?? null,
            previousStopCount: state.problem.stops.length,
            previousVehicleCount: state.problem.vehicles.length,
          },
        });

        return {
          conversationRevision,
          lastConversationAction: deriveConversationAction(nextProblem),
          problem: nextProblem,
          ...clearOptimizationArtifactsForState(state),
        };
      }),
    setResult: (result) =>
      set((state) => ({
        result,
        diagnostics: result ? state.diagnostics : null,
        routeGeometries: result ? state.routeGeometries : [],
        routeGeometryError: result ? state.routeGeometryError : null,
        optimizationDebugTiming: result ? state.optimizationDebugTiming : null,
        optimizationError: null,
        optimizationStatus: result ? "completed" : "idle",
      })),
    setReturnToDepot: (returnToDepot) =>
      set((state) => {
        const problem = {
          ...state.problem,
          returnToDepot,
        };

        return {
          problem,
          ...advanceConversation(state, problem),
          ...clearOptimizationArtifactsForState(state),
        };
      }),
    setRouteGeometries: (routeGeometries) => set({ routeGeometries }),
    setRouteGeometryError: (error) => set({ routeGeometryError: error }),
    setStops: (stops) =>
      set((state) => {
        const problem = {
          ...state.problem,
          stops,
        };
        traceRoutingDebug("STORE_SET_STOPS", {
          conversationId: state.conversationSessionId,
          optimizationId: state.optimizationId,
          problem,
          revision: state.conversationRevision + 1,
          extra: {
            previousStopCount: state.problem.stops.length,
            previousVehicleCount: state.problem.vehicles.length,
          },
        });

        return {
          problem,
          ...advanceConversation(state, problem),
          ...clearOptimizationArtifactsForState(state),
        };
      }),
    setVehicles: (vehicles) =>
      set((state) => {
        const problem = {
          ...state.problem,
          vehicles,
        };
        traceRoutingDebug("STORE_SET_VEHICLES", {
          conversationId: state.conversationSessionId,
          optimizationId: state.optimizationId,
          problem,
          revision: state.conversationRevision + 1,
          extra: {
            previousStopCount: state.problem.stops.length,
            previousVehicleCount: state.problem.vehicles.length,
          },
        });

        return {
          problem,
          ...advanceConversation(state, problem),
          ...clearOptimizationArtifactsForState(state),
        };
      }),
    updateProblem: (patch) =>
      set((state) => {
        const problem = withMigratedOptimizationStrategy({
          ...state.problem,
          ...patch,
        });
        traceRoutingDebug("STORE_UPDATE_PROBLEM", {
          conversationId: state.conversationSessionId,
          optimizationId: state.optimizationId,
          problem,
          revision: state.conversationRevision + 1,
          extra: {
            patchKeys: Object.keys(patch),
            previousStopCount: state.problem.stops.length,
            previousVehicleCount: state.problem.vehicles.length,
          },
        });

        return {
          problem,
          ...advanceConversation(state, problem),
          ...(patchInvalidatesOptimization(patch)
            ? clearOptimizationArtifactsForState(state)
            : {}),
        };
      }),
    updateDepot: (patch) =>
      set((state) => {
        const problem = {
          ...state.problem,
          depot: state.problem.depot
            ? { ...state.problem.depot, ...patch }
            : patch.address
              ? { address: patch.address, ...patch }
              : undefined,
        };

        return {
          problem,
          ...advanceConversation(state, problem),
          ...clearOptimizationArtifactsForState(state),
        };
      }),
    updateStop: (stopId, patch) =>
      set((state) => {
        const problem = {
          ...state.problem,
          stops: state.problem.stops.map((stop) =>
            stop.id === stopId ? { ...stop, ...patch } : stop,
          ),
        };

        return {
          problem,
          ...advanceConversation(state, problem),
          ...clearOptimizationArtifactsForState(state),
        };
      }),
    updateVehicle: (vehicleId, patch) =>
      set((state) => {
        const problem = {
          ...state.problem,
          vehicles: state.problem.vehicles.map((vehicle) =>
            vehicle.id === vehicleId ? { ...vehicle, ...patch } : vehicle,
          ),
        };

        return {
          problem,
          ...advanceConversation(state, problem),
          ...clearOptimizationArtifactsForState(state),
        };
      }),
  }));
}

function createDefaultOptimizationState(options?: {
  conversationSessionId?: string;
  messages?: ConversationMessage[];
  optimizationId?: string | null;
  problem?: RoutingProblem;
}): OptimizationState {
  const problem = cloneRoutingProblem(options?.problem ?? initialRoutingProblem);

  return {
    comparisonError: null,
    comparisonPlans: [],
    comparisonStatus: "idle",
    conversationRevision: 0,
    conversationSessionId:
      options?.conversationSessionId ?? createConversationSessionId(),
    importedFile: null,
    isInterpretingMessage: false,
    lastConversationAction: deriveConversationAction(problem),
    messages:
      options?.messages && options.messages.length > 0
        ? options.messages.map((message) => ({ ...message }))
        : [...initialConversationMessages],
    optimizationError: null,
    optimizationDebugTiming: null,
    optimizationId: options?.optimizationId ?? null,
    optimizationStatus: "idle",
    problem,
    result: null,
    diagnostics: null,
    routeGeometries: [],
    routeGeometryError: null,
    recommendedComparisonPlanId: null,
  };
}

function cloneRoutingProblem(problem: RoutingProblem): RoutingProblem {
  return {
    ...problem,
    depot: problem.depot ? { ...problem.depot } : undefined,
    jobs: problem.jobs?.map((job) => ({
      ...job,
      deliveryStop: job.deliveryStop
        ? cloneStop(job.deliveryStop)
        : undefined,
      pickupDelivery: job.pickupDelivery
        ? {
            pickup: cloneStop(job.pickupDelivery.pickup),
            delivery: cloneStop(job.pickupDelivery.delivery),
          }
        : undefined,
    })),
    capacityDimensions: problem.capacityDimensions?.map((dimension) => ({
      ...dimension,
    })),
    optimizationStrategy: cloneOptimizationStrategy(
      problem.optimizationStrategy ?? strategyFromLegacyObjective(problem.objective),
    ),
    vehicles: problem.vehicles.map((vehicle) => ({
      ...vehicle,
      capacities: vehicle.capacities ? { ...vehicle.capacities } : undefined,
    })),
    stops: problem.stops.map(cloneStop),
  };
}

function cloneStop(stop: DeliveryStop): DeliveryStop {
  return {
    ...stop,
    demands: stop.demands ? { ...stop.demands } : undefined,
    timeWindow: stop.timeWindow ? { ...stop.timeWindow } : undefined,
  };
}

function cloneOptimizationStrategy(strategy?: OptimizationStrategy) {
  return strategy
    ? {
        ...strategy,
        objectives: strategy.objectives.map((objective) => ({ ...objective })),
      }
    : undefined;
}

function withMigratedOptimizationStrategy(
  problem: RoutingProblem,
): RoutingProblem {
  return {
    ...problem,
    optimizationStrategy: cloneOptimizationStrategy(
      problem.optimizationStrategy ?? strategyFromLegacyObjective(problem.objective),
    ),
  };
}

function advanceConversation(
  state: OptimizationState,
  problem: RoutingProblem,
) {
  return {
    conversationRevision: state.conversationRevision + 1,
    lastConversationAction: deriveConversationAction(problem),
  };
}

function clearOptimizationArtifactsForState(state: OptimizationState) {
  return {
    ...clearOptimizationArtifacts(),
    optimizationId: draftOptimizationIdForState(state),
  };
}

function draftOptimizationIdForState(state: OptimizationState) {
  return state.result === null && state.optimizationStatus === "idle"
    ? state.optimizationId
    : null;
}

function createConversationSessionId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `conversation_${crypto.randomUUID()}`;
  }

  return `conversation_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function traceConversationMutation({
  after,
  before,
  extraction,
  options,
}: {
  after: RoutingProblem;
  before: RoutingProblem;
  extraction: RoutingExtraction;
  options?: ConversationMutationTraceOptions;
}) {
  if (process.env.NEXT_PUBLIC_CONVERSATION_DEBUG !== "true") {
    return;
  }

  const capacityDimensions = getCapacityDimensions(after);
  const readiness = validateRoutingProblem(after);
  const nextQuestion = getNextQuestion(after);
  const missingCapacityIssues = readiness.issues.filter(
    (issue) => issue.code === "INVALID_VEHICLE_CAPACITY",
  );

  console.groupCollapsed(
    `[CHAT PATCH][${options?.traceId ?? "no-trace"}] Patch application`,
  );
  console.info("state revision before", options?.stateRevision);
  console.info("raw problem patch", extraction.problemPatch);
  console.info("normalized operations", extraction.operations ?? []);
  console.info("current routing problem before apply", summarizeProblem(before));
  console.info("routing problem after apply", summarizeProblem(after));
  console.info("readiness input", {
    capacityDimensions: capacityDimensions.map((dimension) => dimension.key),
    vehicles: after.vehicles.map((vehicle) => ({
      id: vehicle.id,
      name: vehicle.name,
      capacities: vehicle.capacities,
      operatingCost: vehicle.operatingCost,
      checks: capacityDimensions.map((dimension) => {
        const value = vehicleCapacityValue(vehicle, dimension.key);

        return {
          dimension: dimension.key,
          value,
          missing: typeof value !== "number" || !Number.isFinite(value),
        };
      }),
    })),
  });
  console.info("missing capacity result", missingCapacityIssues);
  console.info("conversation action", {
    id: nextQuestion?.id ?? null,
    type: nextQuestion?.type ?? "ready",
    capacityCardPayload:
      nextQuestion?.type === "vehicle_capacities"
        ? {
            capacityDimensions: nextQuestion.capacityDimensions,
            vehicleIds: nextQuestion.missingVehicleCapacityIds,
          }
        : null,
  });
  console.groupEnd();
}

function traceStaleConversationMutation({
  currentRevision,
  extraction,
  options,
}: {
  currentRevision: number;
  extraction: RoutingExtraction;
  options?: ConversationMutationTraceOptions;
}) {
  if (process.env.NEXT_PUBLIC_CONVERSATION_DEBUG !== "true") {
    return;
  }

  console.info(
    `[CHAT PATCH][${options?.traceId ?? "no-trace"}] Ignored stale extraction`,
    {
      currentRevision,
      extraction,
      responseRevision: options?.stateRevision,
    },
  );
}

function summarizeProblem(problem: RoutingProblem) {
  return {
    capacityDimensions: problem.capacityDimensions?.map((dimension) => dimension.key),
    currency: problem.currency,
    depot: problem.depot?.address,
    ready: validateRoutingProblem(problem).ready,
    returnToDepot: problem.returnToDepot,
    stopCount: problem.stops.length,
    strategyMode: problem.optimizationStrategy?.mode,
    vehicleCount: problem.vehicles.length,
    vehicles: problem.vehicles.map((vehicle) => ({
      capacity: vehicle.capacity,
      capacities: vehicle.capacities,
      id: vehicle.id,
      name: vehicle.name,
      operatingCost: vehicle.operatingCost,
    })),
  };
}

let conversationMessageSequence = 0;

function createConversationMessage(
  role: ConversationMessage["role"],
  content: string,
): ConversationMessage {
  conversationMessageSequence += 1;

  return {
    id: `conversation-message-${conversationMessageSequence}`,
    role,
    content,
  };
}

function clearPersistedConversationId() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem("routespilot.activeConversationId");
}
