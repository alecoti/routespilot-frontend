export type OptimizationObjectiveType =
  | "minimize_time"
  | "minimize_distance"
  | "minimize_vehicles"
  | "balance_workload"
  | "minimize_operating_cost";

export type OptimizationObjective = OptimizationObjectiveType;

export type OptimizationStrategyMode = "preset" | "priority" | "advanced";

export type OptimizationPreset =
  | "fastest"
  | "shortest"
  | "cost_efficient"
  | "balanced";

export type OptimizationObjectiveConfig = {
  type: OptimizationObjectiveType;
  enabled: boolean;
  priority: number;
  weight?: number;
};

export type OptimizationStrategy = {
  mode: OptimizationStrategyMode;
  preset?: OptimizationPreset;
  objectives: OptimizationObjectiveConfig[];
};

export type DeliveryPriority = "critical" | "high" | "normal" | "low";
export type ServicePolicy = "required" | "preferred" | "optional";
export type RoutingJobType = "delivery" | "pickup_delivery";
export type RouteStopRole = "delivery" | "pickup" | "dropoff";
export type TimeWindowMode = "hard" | "soft";
export type CapacityValueType = "integer" | "decimal";

export type CapacityDimensionDefinition = {
  key: string;
  label: string;
  unit: string;
  valueType: CapacityValueType;
  scale?: number;
};

export type CapacityValues = Record<string, number>;

export type TimeWindow = {
  start: string;
  end: string;
  mode?: TimeWindowMode;
  maxLatenessMinutes?: number;
};

export type GeocodingStatus =
  | "pending"
  | "resolved"
  | "needs_review"
  | "not_found"
  | "failed";

export type GeoLocation = {
  address: string;
  latitude?: number;
  longitude?: number;
  formattedAddress?: string;
  geocodingStatus?: GeocodingStatus;
  geocodingConfirmed?: boolean;
  geocodingConfidence?: number;
  geocodingMatchType?: string;
  geocodingCity?: string;
  geocodingPostcode?: string;
  geocodingCountryCode?: string;
  geocodingProvider?: string;
};

export type VehicleOperatingCost = {
  fixedCost?: number;
  costPerKm?: number;
  costPerHour?: number;
  overtimeCostPerHour?: number;
  overtimeAfterMinutes?: number;
};

export type Vehicle = {
  id: string;
  name: string;
  capacity?: number;
  capacities?: CapacityValues;
  operatingCost?: VehicleOperatingCost;
};

export type DeliveryStop = GeoLocation & {
  id: string;
  name: string;
  demand?: number;
  demands?: CapacityValues;
  timeWindow?: TimeWindow;
  serviceTimeSeconds?: number;
  priority?: DeliveryPriority;
  servicePolicy?: ServicePolicy;
};

export type RouteStop = DeliveryStop;

export type PickupDeliveryJob = {
  pickup: RouteStop;
  delivery: RouteStop;
};

export type RoutingJob = {
  id: string;
  type: RoutingJobType;
  priority?: DeliveryPriority;
  servicePolicy?: ServicePolicy;
  deliveryStop?: DeliveryStop;
  pickupDelivery?: PickupDeliveryJob;
};

export type RoutingProblem = {
  id: string;
  name: string;
  depot?: GeoLocation;
  vehicles: Vehicle[];
  stops: DeliveryStop[];
  jobs?: RoutingJob[];
  currency?: string;
  capacityDimensions?: CapacityDimensionDefinition[];
  returnToDepot?: boolean;
  optimizationStrategy?: OptimizationStrategy;
  objective?: OptimizationObjective;
  status: "collecting" | "ready" | "solving" | "completed" | "failed";
};

export type RouteCoordinate = {
  latitude: number;
  longitude: number;
};

export type RouteGeometry = {
  coordinates: RouteCoordinate[];
  distanceMeters?: number;
  durationSeconds?: number;
};

export type VehicleRouteGeometry = {
  vehicleId: string;
  geometry: RouteGeometry;
};

export type RouteGeometryError = {
  code: string;
  message: string;
};

export type DiagnosticIssue = {
  code: string;
  severity: "error" | "warning";
  message: string;
  affectedStopIds: string[];
  affectedVehicleIds: string[];
  details: Record<string, unknown>;
};

export type DiagnosticSuggestion = {
  code: string;
  message: string;
  action?: string;
};

export type InfeasibilityDiagnostics = {
  issues: DiagnosticIssue[];
  suggestions: DiagnosticSuggestion[];
};

export type OptimizationDebugTiming = {
  traceId?: string;
  totalMs?: number;
  validationMs?: number;
  geocodingMs?: number;
  matrixMs?: number;
  preSolveDiagnosticsMs?: number;
  solverQueueMs?: number;
  solverMs?: number;
  solverTotalMs?: number;
  resultValidationMs?: number;
  geometryMs?: number;
  configuredSolverLimitSeconds?: number;
  effectiveSolverLimitSeconds?: number;
  ortoolsStatus?: string;
  normalizedSolverStatus?: string;
  [key: string]: unknown;
};

export type RouteStopResult = {
  stopId: string;
  jobId?: string;
  stopRole?: RouteStopRole;
  order: number;
  eta?: string;
  etaSeconds?: number;
  timeWindowLatenessSeconds?: number;
  loadAfterStop?: number;
  loadsAfterStop?: CapacityValues;
  distanceFromPreviousMeters?: number;
  distanceFromPreviousKm?: number;
  durationFromPreviousSeconds?: number;
  durationFromPreviousMinutes?: number;
};

export type DroppedStopResult = {
  stopId: string;
  jobId?: string;
  stopRole?: RouteStopRole;
  reason: string;
  penalty?: number;
  priority: DeliveryPriority;
  servicePolicy: ServicePolicy;
};

export type VehicleRouteResult = {
  vehicleId: string;
  distanceMeters?: number;
  distanceKm: number;
  durationSeconds?: number;
  durationMinutes: number;
  totalLoad?: number;
  capacityUsage?: Record<
    string,
    {
      used: number;
      capacity: number;
      label: string;
      unit: string;
    }
  >;
  startTimeSeconds?: number;
  endTimeSeconds?: number;
  stops: RouteStopResult[];
};

export type ObjectiveMetrics = {
  totalTravelTimeSeconds: number;
  totalDistanceMeters: number;
  vehiclesUsed: number;
  workloadSpanSeconds: number;
  totalOperatingCostMinor?: number;
};

export type OperatingCostBreakdown = {
  fixedCostMinor: number;
  distanceCostMinor: number;
  timeCostMinor: number;
  overtimeCostMinor: number;
  softPenaltyCostMinor?: number;
  totalCostMinor: number;
  currency: string;
};

export type VehicleOperatingCostBreakdown = {
  vehicleId: string;
  breakdown: OperatingCostBreakdown;
};

export type OperatingCostSummary = {
  currency: string;
  total: OperatingCostBreakdown;
  vehicles: VehicleOperatingCostBreakdown[];
};

export type ObjectivePassResult = {
  objective: OptimizationObjectiveType;
  status: "completed" | "partial" | "skipped" | "time_limit";
  durationMs: number;
  metricValue?: number;
};

export type RoutingResult = {
  problemId: string;
  routes: VehicleRouteResult[];
  totalDistanceMeters?: number;
  totalDistanceKm: number;
  totalDurationSeconds?: number;
  totalDurationMinutes: number;
  vehiclesUsed: number;
  feasible: boolean;
  warnings: string[];
  solverStatus: "feasible" | "infeasible" | "invalid" | "time_limit";
  solveTimeMs: number;
  droppedStops: DroppedStopResult[];
  servedStops: number;
  droppedStopsCount: number;
  optimizationStrategySummary?: string;
  objectiveMetrics?: ObjectiveMetrics;
  objectiveScore?: number;
  objectivePasses: ObjectivePassResult[];
  operatingCost?: OperatingCostSummary;
};

export type ComparisonPlanType =
  | "fastest"
  | "lowest_cost"
  | "shortest"
  | "balanced";

export type ComparisonPlanStatus =
  | "completed"
  | "infeasible"
  | "time_limit"
  | "unavailable"
  | "failed";

export type ComparisonPlanMetrics = {
  vehiclesUsed: number;
  totalDistanceMeters: number;
  totalTravelTimeSeconds: number;
  totalRouteElapsedSeconds: number;
  workloadSpanSeconds: number;
  estimatedOperatingCostMinor?: number;
  servedStops: number;
  droppedStops: number;
  lateFlexibleStops: number;
};

export type ComparativePlan = {
  id: string;
  type: ComparisonPlanType;
  label: string;
  strategy: OptimizationStrategy;
  status: ComparisonPlanStatus;
  result?: RoutingResult;
  metrics?: ComparisonPlanMetrics;
  tradeoffs: string[];
  duplicateOfPlanId?: string;
  isDominated?: boolean;
  unavailableCode?: string;
  unavailableMessage?: string;
};

export type ComparativePlansResult = {
  optimizationId?: string;
  status: "completed" | "failed";
  plans: ComparativePlan[];
  recommendedPlanId?: string;
  problem?: RoutingProblem;
  error?: {
    code: string;
    message: string;
  };
};
