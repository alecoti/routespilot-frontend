import type { RoutingProblem } from "@/lib/types";

export type OptimizationArtifacts = {
  comparisonError: null;
  comparisonPlans: [];
  comparisonStatus: "idle";
  recommendedComparisonPlanId: null;
  diagnostics: null;
  optimizationError: null;
  optimizationDebugTiming: null;
  optimizationId: null;
  optimizationStatus: "idle";
  result: null;
  routeGeometries: [];
  routeGeometryError: null;
};

const routeInputKeys = [
  "depot",
  "id",
  "capacityDimensions",
  "objective",
  "optimizationStrategy",
  "returnToDepot",
  "jobs",
  "stops",
  "vehicles",
] as const;

export function clearOptimizationArtifacts(): OptimizationArtifacts {
  return {
    comparisonError: null,
    comparisonPlans: [],
    comparisonStatus: "idle",
    recommendedComparisonPlanId: null,
    diagnostics: null,
    optimizationError: null,
    optimizationDebugTiming: null,
    optimizationId: null,
    optimizationStatus: "idle",
    result: null,
    routeGeometries: [],
    routeGeometryError: null,
  };
}

export function patchInvalidatesOptimization(patch: Partial<RoutingProblem>) {
  return routeInputKeys.some((key) => key in patch);
}
