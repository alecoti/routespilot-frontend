export type ConversationQuestionType =
  | "text"
  | "address"
  | "boolean"
  | "single_select"
  | "number"
  | "vehicle_capacities";

export type ConversationOption = {
  label: string;
  value: string;
};

export type ConversationQuestion = {
  id: string;
  type: ConversationQuestionType;
  message: string;
  capacityDimensions?: {
    key: string;
    label: string;
    unit: string;
  }[];
  missingVehicleCapacityIds?: string[];
  options?: ConversationOption[];
};

export type ConversationMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
};

export type ConversationPhase =
  | "empty"
  | "collecting"
  | "needs_clarification"
  | "awaiting_confirmation"
  | "has_conflicts"
  | "ready_for_review"
  | "ready_to_optimize"
  | "optimizing"
  | "result_available";

export type ConversationMissingRequirement = {
  code: string;
  field: string;
  message: string;
  category?: "route" | "vehicles" | "deliveries" | "strategy" | "locations";
  entityType?: "problem" | "vehicle" | "stop" | "depot";
  entityId?: string;
  entityName?: string;
  dimensionKey?: string;
  dimensionLabel?: string;
  expectedUnit?: string;
  severity?: "missing" | "invalid";
  vehicleIds?: string[];
  stopIds?: string[];
};

export type ConversationAmbiguity = {
  field: string;
  message: string;
};

export type ConversationConflict = {
  code: string;
  field: string;
  message: string;
  affectedVehicleIds?: string[];
  affectedStopIds?: string[];
  details?: Record<string, string | number | boolean | null>;
};

export type ConversationUnresolvedLocation = {
  id: string;
  type: "depot" | "stop";
  name: string;
  address: string;
  status: "needs_review" | "not_found" | "failed" | "pending";
  message: string;
};

export type ConversationNextActionCandidate = {
  type:
    | "ASK_MISSING_INFORMATION"
    | "REVIEW_LOCATIONS"
    | "SHOW_BLOCKER"
    | "PROCEED_TO_REVIEW"
    | "READY_TO_OPTIMIZE";
  label: string;
  field?: string;
  priority: number;
};

export type ReadinessAssessment = {
  readyForReview: boolean;
  readyForOptimization: boolean;
  missingRequirements: ConversationMissingRequirement[];
  unresolvedLocations: ConversationUnresolvedLocation[];
  ambiguities: ConversationAmbiguity[];
  blockers: ConversationConflict[];
  conflicts: ConversationConflict[];
  warnings: string[];
  nextActionCandidates: ConversationNextActionCandidate[];
};

export type ConversationActionType =
  | "ASK_MISSING_INFORMATION"
  | "ASK_CLARIFICATION"
  | "SHOW_IMPORT_SUMMARY"
  | "REQUEST_CONFIRMATION"
  | "REVIEW_LOCATIONS"
  | "SHOW_CONFLICT"
  | "SHOW_SUMMARY"
  | "PROCEED_TO_REVIEW"
  | "READY_TO_OPTIMIZE"
  | "INFORMATIONAL_RESPONSE";

export type ConversationAction = {
  type: ConversationActionType;
  message: string;
  question?: ConversationQuestion | null;
  readiness: ReadinessAssessment;
};

export type ImportedFileStatus =
  | "idle"
  | "uploading"
  | "parsing"
  | "success"
  | "needs_mapping"
  | "needs_review"
  | "failed";

export type ImportedFileState = {
  id: string;
  fileName: string;
  status: ImportedFileStatus;
  rowCount?: number;
  validRowCount?: number;
  importedStopIds?: string[];
  warnings?: string[];
  error?: string;
};

export type ConversationPlanningState = {
  sessionId: string;
  revision: number;
  phase: ConversationPhase;
  pendingConfirmation: ConversationAction | null;
  unresolvedAmbiguities: ConversationAmbiguity[];
  importedFile: ImportedFileState | null;
  readiness: ReadinessAssessment;
  currentFocus: string | null;
  lastAction: ConversationAction | null;
};

export type VehicleCapacityAnswer = {
  vehicleId: string;
  vehicleName?: string;
  dimensionKey?: string;
  capacity: number;
};

export type ConversationAnswer =
  | string
  | number
  | boolean
  | VehicleCapacityAnswer[];
