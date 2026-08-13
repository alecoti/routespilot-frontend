import type { ConversationQuestion } from "@/lib/conversation-types";
import type { RoutingValidationResult } from "@/lib/routing-validation";
import type {
  OptimizationObjective,
  OptimizationPreset,
  OptimizationStrategy,
  CapacityDimensionDefinition,
  CapacityValues,
  DeliveryPriority,
  RoutingProblem,
  RoutingJob,
  ServicePolicy,
  TimeWindow,
  VehicleOperatingCost,
} from "@/lib/types";

export type ConversationPrimaryIntent =
  | "mutate_plan"
  | "request_review"
  | "request_optimization"
  | "request_comparison"
  | "select_comparison_plan"
  | "ask_status"
  | "explain_concept"
  | "unsupported"
  | "none";

export type VehicleExtraction = {
  name?: string;
  capacity?: number;
  capacities?: CapacityValues;
  operatingCost?: VehicleOperatingCost;
};

export type DeliveryStopExtraction = {
  id?: string;
  name?: string;
  address?: string;
  demand?: number;
  demands?: CapacityValues;
  timeWindow?: TimeWindow;
  serviceTimeSeconds?: number;
  priority?: DeliveryPriority;
  servicePolicy?: ServicePolicy;
};

export type PickupDeliveryExtraction = {
  pickup: DeliveryStopExtraction;
  delivery: DeliveryStopExtraction;
};

export type RoutingJobExtraction = {
  id?: string;
  type: RoutingJob["type"];
  priority?: DeliveryPriority;
  servicePolicy?: ServicePolicy;
  deliveryStop?: DeliveryStopExtraction;
  pickupDelivery?: PickupDeliveryExtraction;
};

export type RoutingProblemPatch = {
  depot?: string;
  currency?: string;
  vehicleCount?: number;
  capacityDimensions?: CapacityDimensionDefinition[];
  vehicles?: VehicleExtraction[];
  returnToDepot?: boolean;
  optimizationStrategy?: OptimizationStrategy;
  objective?: OptimizationObjective;
  stops?: DeliveryStopExtraction[];
  jobs?: RoutingJobExtraction[];
};

export type ExtractionAmbiguity = {
  field: string;
  message: string;
};

export type UnsupportedConversationRequest = {
  capability: string;
  message: string;
};

export type ConversationPatchOperation =
  | { type: "SET_DEPOT"; address: string }
  | { type: "SET_RETURN_TO_DEPOT"; returnToDepot: boolean }
  | { type: "SET_CURRENCY"; currency: string }
  | { type: "SET_VEHICLE_COUNT"; count: number }
  | { type: "ADD_CAPACITY_DIMENSION"; dimension: CapacityDimensionDefinition }
  | { type: "REMOVE_CAPACITY_DIMENSION"; dimensionKey: string }
  | { type: "ADD_VEHICLE"; vehicle: VehicleExtraction }
  | {
      type: "UPDATE_VEHICLE";
      vehicleReference?: string;
      vehicleIndex?: number;
      patch: VehicleExtraction;
    }
  | {
      type: "RENAME_VEHICLE";
      vehicleReference: string;
      name: string;
    }
  | {
      type: "REMOVE_VEHICLE";
      vehicleReference: string;
    }
  | {
      type: "SET_VEHICLE_CAPACITY";
      vehicleReference?: string;
      vehicleIndex?: number;
      dimensionKey: string;
      value: number;
      unit?: string;
    }
  | {
      type: "REMOVE_VEHICLE_CAPACITY";
      vehicleReference: string;
      dimensionKey: string;
    }
  | {
      type: "SET_VEHICLE_OPERATING_COST";
      vehicleReference?: string;
      vehicleIndex?: number;
      operatingCost: VehicleOperatingCost;
    }
  | {
      type: "SET_VEHICLE_WORK_LIMIT";
      vehicleReference?: string;
      vehicleIndex?: number;
      maxWorkingMinutes: number;
    }
  | { type: "ADD_DELIVERY"; stop: DeliveryStopExtraction }
  | {
      type: "UPDATE_DELIVERY";
      stopReference?: string;
      stopId?: string;
      patch: DeliveryStopExtraction;
    }
  | { type: "REMOVE_DELIVERY"; stopReference: string }
  | {
      type: "SET_STOP_DEMAND";
      stopReference?: string;
      stopId?: string;
      dimensionKey: string;
      value: number;
      unit?: string;
    }
  | {
      type: "SET_STOP_SERVICE_TIME";
      stopReference?: string;
      stopId?: string;
      serviceTimeSeconds: number;
    }
  | {
      type: "SET_STOP_TIME_WINDOW";
      stopReference?: string;
      stopId?: string;
      timeWindow: TimeWindow;
    }
  | {
      type: "SET_STOP_SERVICE_POLICY";
      stopReference?: string;
      stopId?: string;
      servicePolicy: ServicePolicy;
    }
  | {
      type: "SET_STOP_PRIORITY";
      stopReference?: string;
      stopId?: string;
      priority: DeliveryPriority;
    }
  | {
      type: "ADD_PICKUP_DELIVERY_JOB";
      job: RoutingJobExtraction;
    }
  | {
      type: "UPDATE_PICKUP_DELIVERY_JOB";
      jobReference: string;
      patch: RoutingJobExtraction;
    }
  | { type: "REMOVE_PICKUP_DELIVERY_JOB"; jobReference: string }
  | {
      type: "BULK_UPDATE_STOPS";
      selector: "all" | "required" | "preferred" | "optional";
      patch: DeliveryStopExtraction;
    }
  | {
      type: "BULK_UPDATE_VEHICLES";
      selector: "all";
      patch: VehicleExtraction;
    }
  | { type: "SET_STRATEGY_PRESET"; preset: OptimizationPreset }
  | {
      type: "SET_STRATEGY_PRIORITY";
      objectives: OptimizationStrategy["objectives"];
    }
  | {
      type: "SET_STRATEGY_WEIGHTS";
      objectives: OptimizationStrategy["objectives"];
    }
  | { type: "REQUEST_REVIEW" }
  | { type: "REQUEST_OPTIMIZATION" }
  | { type: "REQUEST_COMPARISON" }
  | { type: "SELECT_COMPARISON_PLAN"; planReference: string }
  | { type: "ASK_STATUS" }
  | { type: "EXPLAIN_CONCEPT"; concept?: string }
  | { type: "UNSUPPORTED_REQUEST"; capability: string; message: string };

export type RoutingExtraction = {
  patchSchemaVersion?: "legacy_problem_patch_v1" | "operations_v1";
  primaryIntent?: ConversationPrimaryIntent;
  problemPatch: RoutingProblemPatch;
  operations?: ConversationPatchOperation[];
  confidence: "high" | "medium" | "low";
  ambiguities: ExtractionAmbiguity[];
  unsupportedRequests?: UnsupportedConversationRequest[];
  informationalRequest?: string;
};

export type ChatExtractRequest = {
  message: string;
  problem: RoutingProblem;
  validation?: RoutingValidationResult;
  currentQuestion?: ConversationQuestion | null;
  conversationContext?: Record<string, unknown>;
  traceId?: string;
  stateRevision?: number;
};

export type ChatExtractResponse = {
  extraction: RoutingExtraction;
  traceId?: string;
  debug?: Record<string, unknown>;
};
