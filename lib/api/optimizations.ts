import { getApiBaseUrl } from "@/lib/api/base-url";
import { handleAuthFailure } from "@/lib/api/auth";
import {
  createIdempotencyKey,
  persistenceHeaders,
} from "@/lib/api/persistence-context";
import type {
  InfeasibilityDiagnostics,
  ObjectivePassResult,
  OperatingCostSummary,
  OptimizationDebugTiming,
  RouteGeometryError,
  RoutingProblem,
  RoutingResult,
  VehicleRouteGeometry,
} from "@/lib/types";

export type OptimizationStatus =
  | "completed"
  | "infeasible"
  | "time_limit"
  | "failed";

export type OptimizationFailureLocation = {
  id: string;
  kind: "depot" | "stop";
  label: string;
  address: string;
  status?: "resolved" | "needs_review" | "not_found" | "failed" | "pending";
  formattedAddress?: string;
  latitude?: number;
  longitude?: number;
  confidence?: number;
  matchType?: string;
  code?: string;
  message?: string;
};

export type OptimizationFailure = {
  code: string;
  message: string;
  details: {
    field?: string;
    code?: string;
    message: string;
  }[];
  locations: OptimizationFailureLocation[];
};

export type OptimizationApiResponse =
  | {
      optimizationId?: string;
      status: "completed" | "infeasible";
      result: RoutingResult;
      problem?: RoutingProblem;
      diagnostics?: InfeasibilityDiagnostics;
      routeGeometries: VehicleRouteGeometry[];
      routeGeometryError?: RouteGeometryError;
      debugTiming?: OptimizationDebugTiming;
    }
  | {
      optimizationId?: string;
      status: "time_limit";
      result: RoutingResult;
      problem?: RoutingProblem;
      diagnostics?: InfeasibilityDiagnostics;
      routeGeometries: VehicleRouteGeometry[];
      routeGeometryError?: RouteGeometryError;
      debugTiming?: OptimizationDebugTiming;
    }
  | {
      optimizationId?: string;
      status: "failed";
      error: OptimizationFailure;
      problem?: RoutingProblem;
      debugTiming?: OptimizationDebugTiming;
    };
export type OptimizationSuccessResponse = Extract<
  OptimizationApiResponse,
  { status: "completed" | "infeasible" | "time_limit" }
>;

type BackendOptimizationResponse = {
  optimization_id?: string | null;
  status: OptimizationStatus;
  result?: BackendRoutingResult | null;
  route_geometries?: BackendVehicleRouteGeometry[];
  route_geometry_error?: BackendRouteGeometryError | null;
  diagnostics?: BackendInfeasibilityDiagnostics | null;
  problem?: RoutingProblem;
  error?: BackendOptimizationFailure | null;
  debug_timing?: BackendOptimizationDebugTiming | null;
};

type BackendOptimizationDebugTiming = {
  trace_id?: string;
  total_ms?: number;
  validation_ms?: number;
  geocoding_ms?: number;
  matrix_ms?: number;
  pre_solve_diagnostics_ms?: number;
  solver_queue_ms?: number;
  solver_ms?: number;
  solver_total_ms?: number;
  result_validation_ms?: number;
  geometry_ms?: number;
  configured_solver_limit_seconds?: number;
  effective_solver_limit_seconds?: number;
  ortools_status?: string;
  normalized_solver_status?: string;
  [key: string]: unknown;
};

type BackendRouteGeometryError = {
  code: string;
  message: string;
};

type BackendOptimizationFailure = {
  code: string;
  message: string;
  details?: {
    field?: string | null;
    code?: string | null;
    message: string;
  }[];
  locations?: {
    id: string;
    kind: "depot" | "stop";
    label: string;
    address: string;
    status?: string | null;
    formatted_address?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    confidence?: number | null;
    match_type?: string | null;
    code?: string | null;
    message?: string | null;
  }[];
};

export type BackendRoutingResult = {
  problem_id: string;
  feasible: boolean;
  routes: BackendVehicleRouteResult[];
  total_distance_meters: number;
  total_duration_seconds: number;
  vehicles_used: number;
  warnings: string[];
  solver_status: "feasible" | "infeasible" | "invalid" | "time_limit";
  solve_time_ms: number;
  dropped_stops?: BackendDroppedStopResult[];
  served_stops?: number;
  dropped_stops_count?: number;
  optimization_strategy_summary?: string | null;
  objective_metrics?: BackendObjectiveMetrics | null;
  objective_score?: number | null;
  objective_passes?: BackendObjectivePassResult[];
  operating_cost?: BackendOperatingCostSummary | null;
};

type BackendDroppedStopResult = {
  stop_id: string;
  job_id?: string | null;
  stop_role?: "delivery" | "pickup" | "dropoff" | null;
  reason: string;
  penalty?: number | null;
  priority: "critical" | "high" | "normal" | "low";
  service_policy: "required" | "preferred" | "optional";
};

type BackendObjectiveMetrics = {
  total_travel_time_seconds: number;
  total_distance_meters: number;
  vehicles_used: number;
  workload_span_seconds: number;
  total_operating_cost_minor?: number | null;
};

type BackendOperatingCostBreakdown = {
  fixed_cost_minor: number;
  distance_cost_minor: number;
  time_cost_minor: number;
  overtime_cost_minor: number;
  soft_penalty_cost_minor?: number | null;
  total_cost_minor: number;
  currency: string;
};

type BackendVehicleOperatingCostBreakdown = {
  vehicle_id: string;
  breakdown: BackendOperatingCostBreakdown;
};

type BackendOperatingCostSummary = {
  currency: string;
  total: BackendOperatingCostBreakdown;
  vehicles: BackendVehicleOperatingCostBreakdown[];
};

type BackendObjectivePassResult = {
  objective: ObjectivePassResult["objective"];
  status: ObjectivePassResult["status"];
  duration_ms?: number;
  metric_value?: number | null;
};

type BackendInfeasibilityDiagnostics = {
  issues?: BackendDiagnosticIssue[];
  suggestions?: BackendDiagnosticSuggestion[];
};

type BackendDiagnosticIssue = {
  code: string;
  severity: "error" | "warning";
  message: string;
  affected_stop_ids?: string[];
  affected_vehicle_ids?: string[];
  details?: Record<string, unknown>;
};

type BackendDiagnosticSuggestion = {
  code: string;
  message: string;
  action?: string | null;
};

type BackendVehicleRouteResult = {
  vehicle_id: string;
  stops: BackendRouteStopResult[];
  distance_meters: number;
  duration_seconds: number;
  total_load?: number | null;
  capacity_usage?: Record<
    string,
    {
      used: number;
      capacity: number;
      label: string;
      unit?: string | null;
    }
  >;
  start_time?: number | null;
  end_time?: number | null;
};

type BackendRouteStopResult = {
  stop_id: string;
  job_id?: string | null;
  stop_role?: "delivery" | "pickup" | "dropoff" | null;
  sequence: number;
  eta_seconds?: number | null;
  time_window_lateness_seconds?: number | null;
  load_after_stop?: number | null;
  loads_after_stop?: Record<string, number>;
  distance_from_previous_meters?: number | null;
  duration_from_previous_seconds?: number | null;
};

export type BackendVehicleRouteGeometry = {
  vehicle_id: string;
  geometry: BackendRouteGeometry;
};

type BackendRouteGeometry = {
  coordinates: BackendRouteCoordinate[];
  distance_meters?: number | null;
  duration_seconds?: number | null;
};

type BackendRouteCoordinate = {
  latitude: number;
  longitude: number;
};

export class OptimizationApiError extends Error {
  failure?: OptimizationFailure;
  response?: OptimizationApiResponse;
  statusCode: number;

  constructor({
    failure,
    message,
    response,
    statusCode,
  }: {
    failure?: OptimizationFailure;
    message: string;
    response?: OptimizationApiResponse;
    statusCode: number;
  }) {
    super(message);
    this.name = "OptimizationApiError";
    this.failure = failure;
    this.response = response;
    this.statusCode = statusCode;
  }
}

export async function optimizeRoutingProblem(
  problem: RoutingProblem,
  options: { optimizationId?: string | null } = {},
): Promise<OptimizationSuccessResponse> {
  const debugEnabled = process.env.NEXT_PUBLIC_OPTIMIZATION_DEBUG === "true";
  const traceId = createOptimizationTraceId();
  const startedAt = performance.now();

  if (debugEnabled) {
    console.groupCollapsed("[RoutesPilot Optimization] request sent");
    console.info({
      traceId,
      problemId: problem.id,
      stops: problem.stops.length,
      vehicles: problem.vehicles.length,
      capacityDimensions: problem.capacityDimensions?.map((dimension) => dimension.key),
      strategy: problem.optimizationStrategy?.mode,
      timestamp: new Date().toISOString(),
    });
    console.groupEnd();
  }

  const response = await fetch(`${getApiBaseUrl()}/optimizations`, {
    credentials: "include",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-RoutesPilot-Optimization-Trace-Id": traceId,
      ...(options.optimizationId
        ? { "X-RoutesPilot-Optimization-Id": options.optimizationId }
        : {}),
      ...persistenceHeaders({ idempotencyKey: createIdempotencyKey() }),
    },
    body: JSON.stringify(problem),
    cache: "no-store",
  });

  const payload: unknown = await readJson(response);
  handleAuthFailure(response);

  if (!isBackendOptimizationResponse(payload)) {
    throw new OptimizationApiError({
      message: "Optimization response was malformed.",
      statusCode: response.status,
    });
  }

  const normalizedResponse = normalizeOptimizationResponse(payload);
  const frontendWaitMs = Math.round(performance.now() - startedAt);

  if (debugEnabled) {
    console.groupCollapsed("[RoutesPilot Optimization] response received");
    console.info({
      traceId:
        response.headers.get("X-RoutesPilot-Optimization-Trace-Id") ??
        normalizedResponse.debugTiming?.traceId ??
        traceId,
      httpStatus: response.status,
      frontendWaitMs,
      backendStatus: normalizedResponse.status,
      solverStatus:
        normalizedResponse.status !== "failed"
          ? normalizedResponse.result.solverStatus
          : undefined,
      solverElapsedMs:
        normalizedResponse.status !== "failed"
          ? normalizedResponse.result.solveTimeMs
          : undefined,
      backendTotalMs: normalizedResponse.debugTiming?.totalMs,
      debugTiming: normalizedResponse.debugTiming,
    });
    console.groupEnd();
  }

  if (!response.ok || normalizedResponse.status === "failed") {
    throw new OptimizationApiError({
      failure:
        normalizedResponse.status === "failed"
          ? normalizedResponse.error
          : undefined,
      message:
        normalizedResponse.status === "failed"
          ? normalizedResponse.error.message
          : "Optimization request failed.",
      response: normalizedResponse,
      statusCode: response.status,
    });
  }

  return normalizedResponse;
}

async function readJson(response: Response) {
  try {
    return await response.json();
  } catch {
    throw new OptimizationApiError({
      message: "Optimization response was not valid JSON.",
      statusCode: response.status,
    });
  }
}

function normalizeOptimizationResponse(
  response: BackendOptimizationResponse,
): OptimizationApiResponse {
  if (response.status === "failed") {
    return {
      optimizationId: response.optimization_id ?? undefined,
      status: "failed",
      problem: response.problem,
      error: normalizeOptimizationFailure(response.error),
      debugTiming: normalizeDebugTiming(response.debug_timing),
    };
  }

  if (!response.result) {
    throw new OptimizationApiError({
      message: "Optimization response did not include a result.",
      statusCode: 200,
    });
  }

  return {
    optimizationId: response.optimization_id ?? undefined,
    status: response.status,
    problem: response.problem,
    result: normalizeRoutingResult(response.result),
    diagnostics: response.diagnostics
      ? normalizeDiagnostics(response.diagnostics)
      : undefined,
    routeGeometries: (response.route_geometries ?? []).map(
      normalizeVehicleRouteGeometry,
    ),
    routeGeometryError: response.route_geometry_error
      ? {
          code: response.route_geometry_error.code,
          message: response.route_geometry_error.message,
        }
      : undefined,
    debugTiming: normalizeDebugTiming(response.debug_timing),
  };
}

function normalizeDebugTiming(
  timing?: BackendOptimizationDebugTiming | null,
): OptimizationDebugTiming | undefined {
  if (!timing) {
    return undefined;
  }

  return {
    traceId: timing.trace_id,
    totalMs: timing.total_ms,
    validationMs: timing.validation_ms,
    geocodingMs: timing.geocoding_ms,
    matrixMs: timing.matrix_ms,
    preSolveDiagnosticsMs: timing.pre_solve_diagnostics_ms,
    solverQueueMs: timing.solver_queue_ms,
    solverMs: timing.solver_ms,
    solverTotalMs: timing.solver_total_ms,
    resultValidationMs: timing.result_validation_ms,
    geometryMs: timing.geometry_ms,
    configuredSolverLimitSeconds: timing.configured_solver_limit_seconds,
    effectiveSolverLimitSeconds: timing.effective_solver_limit_seconds,
    ortoolsStatus: timing.ortools_status,
    normalizedSolverStatus: timing.normalized_solver_status,
    ...timing,
  };
}

function normalizeDiagnostics(
  diagnostics: BackendInfeasibilityDiagnostics,
): InfeasibilityDiagnostics {
  return {
    issues:
      diagnostics.issues?.map((issue) => ({
        code: issue.code,
        severity: issue.severity,
        message: issue.message,
        affectedStopIds: issue.affected_stop_ids ?? [],
        affectedVehicleIds: issue.affected_vehicle_ids ?? [],
        details: issue.details ?? {},
      })) ?? [],
    suggestions:
      diagnostics.suggestions?.map((suggestion) => ({
        code: suggestion.code,
        message: suggestion.message,
        action: suggestion.action ?? undefined,
      })) ?? [],
  };
}

function normalizeOptimizationFailure(
  failure?: BackendOptimizationFailure | null,
): OptimizationFailure {
  return {
    code: failure?.code ?? "SOLVER_ERROR",
    message: failure?.message ?? "Optimization could not be completed.",
    details:
      failure?.details?.map((detail) => ({
        field: detail.field ?? undefined,
        code: detail.code ?? undefined,
        message: detail.message,
      })) ?? [],
    locations:
      failure?.locations?.map((location) => ({
        id: location.id,
        kind: location.kind,
        label: location.label,
        address: location.address,
        status: isOptimizationFailureLocationStatus(location.status)
          ? location.status
          : undefined,
        formattedAddress: location.formatted_address ?? undefined,
        latitude:
          typeof location.latitude === "number" ? location.latitude : undefined,
        longitude:
          typeof location.longitude === "number" ? location.longitude : undefined,
        confidence:
          typeof location.confidence === "number"
            ? location.confidence
            : undefined,
        matchType: location.match_type ?? undefined,
        code: location.code ?? undefined,
        message: location.message ?? undefined,
      })) ?? [],
  };
}

function isOptimizationFailureLocationStatus(
  value: unknown,
): value is OptimizationFailureLocation["status"] {
  return (
    value === "resolved" ||
    value === "needs_review" ||
    value === "not_found" ||
    value === "failed" ||
    value === "pending"
  );
}

export function normalizeRoutingResult(result: BackendRoutingResult): RoutingResult {
  return {
    problemId: result.problem_id,
    routes: result.routes.map((route) => ({
      vehicleId: route.vehicle_id,
      distanceMeters: route.distance_meters,
      distanceKm: metersToKilometers(route.distance_meters),
      durationSeconds: route.duration_seconds,
      durationMinutes: secondsToMinutes(route.duration_seconds),
      totalLoad:
        typeof route.total_load === "number" ? route.total_load : undefined,
      capacityUsage: normalizeCapacityUsage(route.capacity_usage),
      startTimeSeconds:
        typeof route.start_time === "number" ? route.start_time : undefined,
      endTimeSeconds:
        typeof route.end_time === "number" ? route.end_time : undefined,
      stops: route.stops.map((stop) => ({
        stopId: stop.stop_id,
        jobId: stop.job_id ?? undefined,
        stopRole: stop.stop_role ?? "delivery",
        order: stop.sequence,
        eta:
          typeof stop.eta_seconds === "number"
            ? formatSecondsAsTime(stop.eta_seconds)
            : undefined,
        etaSeconds:
          typeof stop.eta_seconds === "number" ? stop.eta_seconds : undefined,
        timeWindowLatenessSeconds:
          typeof stop.time_window_lateness_seconds === "number"
            ? stop.time_window_lateness_seconds
            : undefined,
        loadAfterStop:
          typeof stop.load_after_stop === "number"
            ? stop.load_after_stop
            : undefined,
        loadsAfterStop: stop.loads_after_stop,
        distanceFromPreviousMeters:
          typeof stop.distance_from_previous_meters === "number"
            ? stop.distance_from_previous_meters
            : undefined,
        distanceFromPreviousKm:
          typeof stop.distance_from_previous_meters === "number"
            ? metersToKilometers(stop.distance_from_previous_meters)
            : undefined,
        durationFromPreviousSeconds:
          typeof stop.duration_from_previous_seconds === "number"
            ? stop.duration_from_previous_seconds
            : undefined,
        durationFromPreviousMinutes:
          typeof stop.duration_from_previous_seconds === "number"
            ? secondsToMinutes(stop.duration_from_previous_seconds)
            : undefined,
      })),
    })),
    totalDistanceMeters: result.total_distance_meters,
    totalDistanceKm: metersToKilometers(result.total_distance_meters),
    totalDurationSeconds: result.total_duration_seconds,
    totalDurationMinutes: secondsToMinutes(result.total_duration_seconds),
    vehiclesUsed: result.vehicles_used,
    feasible: result.feasible,
    warnings: result.warnings,
    solverStatus: result.solver_status,
    solveTimeMs: result.solve_time_ms,
    droppedStops:
      result.dropped_stops?.map((stop) => ({
        stopId: stop.stop_id,
        jobId: stop.job_id ?? undefined,
        stopRole: stop.stop_role ?? "delivery",
        reason: stop.reason,
        penalty: typeof stop.penalty === "number" ? stop.penalty : undefined,
        priority: stop.priority,
        servicePolicy: stop.service_policy,
      })) ?? [],
    servedStops: result.served_stops ?? countServedStops(result),
    droppedStopsCount:
      result.dropped_stops_count ?? result.dropped_stops?.length ?? 0,
    optimizationStrategySummary:
      result.optimization_strategy_summary ?? undefined,
    objectiveMetrics: result.objective_metrics
      ? {
          totalTravelTimeSeconds:
            result.objective_metrics.total_travel_time_seconds,
          totalDistanceMeters: result.objective_metrics.total_distance_meters,
          vehiclesUsed: result.objective_metrics.vehicles_used,
          workloadSpanSeconds: result.objective_metrics.workload_span_seconds,
          totalOperatingCostMinor:
            typeof result.objective_metrics.total_operating_cost_minor === "number"
              ? result.objective_metrics.total_operating_cost_minor
              : undefined,
        }
      : undefined,
    objectiveScore:
      typeof result.objective_score === "number"
        ? result.objective_score
        : undefined,
    objectivePasses:
      result.objective_passes?.map((pass) => ({
        objective: pass.objective,
        status: pass.status,
        durationMs: pass.duration_ms ?? 0,
        metricValue:
          typeof pass.metric_value === "number" ? pass.metric_value : undefined,
      })) ?? [],
    operatingCost: result.operating_cost
      ? normalizeOperatingCostSummary(result.operating_cost)
      : undefined,
  };
}

function normalizeCapacityUsage(
  usage?: BackendVehicleRouteResult["capacity_usage"],
) {
  if (!usage) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(usage).map(([key, value]) => [
      key,
      {
        used: value.used,
        capacity: value.capacity,
        label: value.label,
        unit: value.unit ?? "",
      },
    ]),
  );
}

function normalizeOperatingCostSummary(
  summary: BackendOperatingCostSummary,
): OperatingCostSummary {
  return {
    currency: summary.currency,
    total: normalizeOperatingCostBreakdown(summary.total),
    vehicles: summary.vehicles.map((vehicle) => ({
      vehicleId: vehicle.vehicle_id,
      breakdown: normalizeOperatingCostBreakdown(vehicle.breakdown),
    })),
  };
}

function normalizeOperatingCostBreakdown(
  breakdown: BackendOperatingCostBreakdown,
) {
  return {
    fixedCostMinor: breakdown.fixed_cost_minor,
    distanceCostMinor: breakdown.distance_cost_minor,
    timeCostMinor: breakdown.time_cost_minor,
    overtimeCostMinor: breakdown.overtime_cost_minor,
    softPenaltyCostMinor:
      typeof breakdown.soft_penalty_cost_minor === "number"
        ? breakdown.soft_penalty_cost_minor
        : undefined,
    totalCostMinor: breakdown.total_cost_minor,
    currency: breakdown.currency,
  };
}

function countServedStops(result: BackendRoutingResult) {
  return result.routes.reduce((count, route) => count + route.stops.length, 0);
}

export function normalizeVehicleRouteGeometry(
  routeGeometry: BackendVehicleRouteGeometry,
): VehicleRouteGeometry {
  return {
    vehicleId: routeGeometry.vehicle_id,
    geometry: {
      coordinates: routeGeometry.geometry.coordinates.map((coordinate) => ({
        latitude: coordinate.latitude,
        longitude: coordinate.longitude,
      })),
      distanceMeters:
        typeof routeGeometry.geometry.distance_meters === "number"
          ? routeGeometry.geometry.distance_meters
          : undefined,
      durationSeconds:
        typeof routeGeometry.geometry.duration_seconds === "number"
          ? routeGeometry.geometry.duration_seconds
          : undefined,
    },
  };
}

function metersToKilometers(meters: number) {
  return Number((meters / 1000).toFixed(1));
}

function secondsToMinutes(seconds: number) {
  return Math.max(0, Math.round(seconds / 60));
}

function formatSecondsAsTime(seconds: number) {
  const normalizedSeconds = ((seconds % 86400) + 86400) % 86400;
  const hours = Math.floor(normalizedSeconds / 3600);
  const minutes = Math.floor((normalizedSeconds % 3600) / 60);

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function createOptimizationTraceId() {
  const randomId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);

  return `opt_trace_${randomId.replaceAll("-", "")}`;
}

function isBackendOptimizationResponse(
  value: unknown,
): value is BackendOptimizationResponse {
  if (typeof value !== "object" || value === null || !("status" in value)) {
    return false;
  }

  const status = value.status;

  return (
    status === "completed" ||
    status === "infeasible" ||
    status === "time_limit" ||
    status === "failed"
  );
}
