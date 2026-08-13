import { getApiBaseUrl } from "@/lib/api/base-url";
import { handleAuthFailure } from "@/lib/api/auth";
import {
  normalizeRoutingResult,
  type BackendRoutingResult,
} from "@/lib/api/optimizations";
import {
  createIdempotencyKey,
  persistenceHeaders,
} from "@/lib/api/persistence-context";
import type {
  ComparativePlan,
  ComparativePlansResult,
  ComparisonPlanType,
  OptimizationStrategy,
  RoutingProblem,
} from "@/lib/types";

type BackendComparisonPlanMetrics = {
  vehicles_used: number;
  total_distance_meters: number;
  total_travel_time_seconds: number;
  total_route_elapsed_seconds: number;
  workload_span_seconds: number;
  estimated_operating_cost_minor?: number | null;
  served_stops: number;
  dropped_stops: number;
  late_flexible_stops: number;
};

type BackendComparativePlan = {
  id: string;
  type: ComparisonPlanType;
  label: string;
  strategy: OptimizationStrategy;
  status: ComparativePlan["status"];
  result?: BackendRoutingResult | null;
  metrics?: BackendComparisonPlanMetrics | null;
  tradeoffs?: string[];
  duplicate_of_plan_id?: string | null;
  is_dominated?: boolean;
  unavailable_code?: string | null;
  unavailable_message?: string | null;
};

type BackendComparativePlansResult = {
  optimization_id?: string | null;
  status: "completed" | "failed";
  plans?: BackendComparativePlan[];
  recommended_plan_id?: string | null;
  problem?: RoutingProblem;
  error?: {
    code: string;
    message: string;
  } | null;
};

type ApiErrorPayload = {
  detail?: {
    code?: string;
    message?: string;
  };
};

export class ComparisonApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ComparisonApiError";
  }
}

export async function compareOptimizationPlans(
  problem: RoutingProblem,
  optimizationId?: string | null,
  planTypes: ComparisonPlanType[] = [
    "fastest",
    "lowest_cost",
    "shortest",
    "balanced",
  ],
): Promise<ComparativePlansResult> {
  const response = await fetch(`${getApiBaseUrl()}/optimizations/compare`, {
    credentials: "include",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...persistenceHeaders({ idempotencyKey: createIdempotencyKey() }),
    },
    body: JSON.stringify({
      problem,
      optimization_id: optimizationId ?? undefined,
      plan_types: planTypes,
    }),
    cache: "no-store",
  });
  const payload: unknown = await response.json();
  handleAuthFailure(response);

  if (!response.ok) {
    throw toComparisonApiError(payload);
  }

  if (!isBackendComparativePlansResult(payload)) {
    throw new ComparisonApiError("Comparison response was malformed.");
  }

  const normalized = normalizeComparativePlansResult(payload);

  if (normalized.status === "failed") {
    throw new ComparisonApiError(
      normalized.error?.message ?? "Comparison could not be completed.",
    );
  }

  return normalized;
}

function toComparisonApiError(payload: unknown) {
  const error = payload as ApiErrorPayload;

  return new ComparisonApiError(
    error.detail?.message ?? "Comparison could not be completed.",
  );
}

function normalizeComparativePlansResult(
  response: BackendComparativePlansResult,
): ComparativePlansResult {
  return {
    status: response.status,
    optimizationId: response.optimization_id ?? undefined,
    problem: response.problem,
    recommendedPlanId: response.recommended_plan_id ?? undefined,
    error: response.error
      ? {
          code: response.error.code,
          message: response.error.message,
        }
      : undefined,
    plans:
      response.plans?.map((plan) => ({
        id: plan.id,
        type: plan.type,
        label: plan.label,
        strategy: plan.strategy,
        status: plan.status,
        result: plan.result ? normalizeRoutingResult(plan.result) : undefined,
        metrics: plan.metrics
          ? {
              vehiclesUsed: plan.metrics.vehicles_used,
              totalDistanceMeters: plan.metrics.total_distance_meters,
              totalTravelTimeSeconds: plan.metrics.total_travel_time_seconds,
              totalRouteElapsedSeconds:
                plan.metrics.total_route_elapsed_seconds,
              workloadSpanSeconds: plan.metrics.workload_span_seconds,
              estimatedOperatingCostMinor:
                typeof plan.metrics.estimated_operating_cost_minor === "number"
                  ? plan.metrics.estimated_operating_cost_minor
                  : undefined,
              servedStops: plan.metrics.served_stops,
              droppedStops: plan.metrics.dropped_stops,
              lateFlexibleStops: plan.metrics.late_flexible_stops,
            }
          : undefined,
        tradeoffs: plan.tradeoffs ?? [],
        duplicateOfPlanId: plan.duplicate_of_plan_id ?? undefined,
        isDominated: plan.is_dominated,
        unavailableCode: plan.unavailable_code ?? undefined,
        unavailableMessage: plan.unavailable_message ?? undefined,
      })) ?? [],
  };
}

function isBackendComparativePlansResult(
  value: unknown,
): value is BackendComparativePlansResult {
  return (
    typeof value === "object" &&
    value !== null &&
    "status" in value &&
    ((value as { status?: unknown }).status === "completed" ||
      (value as { status?: unknown }).status === "failed")
  );
}
