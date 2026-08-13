"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  LoaderCircle,
  MapPin,
  Rocket,
  Ticket,
  TriangleAlert,
} from "lucide-react";

import {
  OptimizationApiError,
  optimizeRoutingProblem,
  type OptimizationFailureLocation,
} from "@/lib/api/optimizations";
import { formatOptimizationStrategy } from "@/lib/formatters";
import { formatLocationAddress } from "@/lib/locations";
import {
  describeOptimizationStrategy,
  getEffectiveOptimizationStrategy,
} from "@/lib/optimization-strategy";
import { assessConversationReadiness } from "@/lib/conversation-readiness";
import { traceRoutingDebug } from "@/lib/routing-debug";
import { useOptimizationStore } from "@/providers/optimization-provider";
import type {
  GeoLocation,
  OptimizationDebugTiming,
  VehicleOperatingCost,
} from "@/lib/types";
import type { OptimizationFailure } from "@/lib/api/optimizations";

export function OptimizationSummary() {
  const router = useRouter();
  const optimizeInFlightRef = useRef(false);
  const [failedLocations, setFailedLocations] = useState<FailedLocation[]>([]);
  const [progressElapsedMs, setProgressElapsedMs] = useState(0);
  const [progressRunId, setProgressRunId] = useState(0);
  const [progressTiming, setProgressTiming] =
    useState<OptimizationDebugTiming | null>(null);
  const [progressOutcome, setProgressOutcome] =
    useState<OptimizationProgressOutcome>("running");
  const [progressFailureCode, setProgressFailureCode] =
    useState<OptimizationFailure["code"] | null>(null);
  const optimizationError = useOptimizationStore(
    (state) => state.optimizationError,
  );
  const optimizationStatus = useOptimizationStore(
    (state) => state.optimizationStatus,
  );
  const optimizationId = useOptimizationStore((state) => state.optimizationId);
  const problem = useOptimizationStore((state) => state.problem);
  const setOptimizationError = useOptimizationStore(
    (state) => state.setOptimizationError,
  );
  const setOptimizationDebugTiming = useOptimizationStore(
    (state) => state.setOptimizationDebugTiming,
  );
  const setOptimizationId = useOptimizationStore((state) => state.setOptimizationId);
  const setOptimizationStatus = useOptimizationStore(
    (state) => state.setOptimizationStatus,
  );
  const setDiagnostics = useOptimizationStore((state) => state.setDiagnostics);
  const setProblem = useOptimizationStore((state) => state.setProblem);
  const setResult = useOptimizationStore((state) => state.setResult);
  const setRouteGeometries = useOptimizationStore(
    (state) => state.setRouteGeometries,
  );
  const setRouteGeometryError = useOptimizationStore(
    (state) => state.setRouteGeometryError,
  );
  const updateDepot = useOptimizationStore((state) => state.updateDepot);
  const updateProblem = useOptimizationStore((state) => state.updateProblem);
  const updateStop = useOptimizationStore((state) => state.updateStop);
  const depot = problem.depot;
  const strategy = getEffectiveOptimizationStrategy(problem);
  const strategyDescription = describeOptimizationStrategy(strategy);
  const stops = problem.stops;
  const vehicles = problem.vehicles;
  const costOptimizationActive = Boolean(
    strategy?.objectives.some(
      (objective) =>
        objective.enabled && objective.type === "minimize_operating_cost",
    ),
  );
  const configuredCostCount = vehicles.filter((vehicle) =>
    hasPositiveOperatingCost(vehicle.operatingCost),
  ).length;
  const timeWindowCount = stops.filter((stop) => stop.timeWindow).length;
  const readiness = assessConversationReadiness(problem);
  const blockingIssueCount =
    readiness.missingRequirements.length +
    readiness.blockers.length +
    readiness.unresolvedLocations.length;
  const isOptimizing = optimizationStatus === "optimizing";
  const addressResolutionStats = getAddressResolutionStats(problem);

  useEffect(() => {
    if (!isOptimizing || progressRunId === 0 || progressOutcome !== "running") {
      return;
    }

    const startedAt = window.performance.now();

    const intervalId = window.setInterval(() => {
      setProgressElapsedMs(window.performance.now() - startedAt);
    }, 250);

    return () => window.clearInterval(intervalId);
  }, [isOptimizing, progressOutcome, progressRunId]);

  async function handleOptimize() {
    traceRoutingDebug("OPTIMIZE_CLICK", {
      optimizationId,
      problem,
      extra: {
        blockers: readiness.blockers,
        isOptimizing,
        missingRequirements: readiness.missingRequirements,
        readyForOptimization: readiness.readyForOptimization,
      },
    });

    if (
      !readiness.readyForOptimization ||
      isOptimizing ||
      optimizeInFlightRef.current
    ) {
      return;
    }

    optimizeInFlightRef.current = true;
    setFailedLocations([]);
    setResult(null);
    setDiagnostics(null);
    setRouteGeometries([]);
    setRouteGeometryError(null);
    setOptimizationError(null);
    setOptimizationDebugTiming(null);
    setOptimizationId(null);
    setOptimizationStatus("optimizing");
    setProgressElapsedMs(0);
    setProgressOutcome("running");
    setProgressFailureCode(null);
    setProgressRunId((runId) => runId + 1);
    setProgressTiming(null);
    updateProblem({ status: "solving" });

    try {
      traceRoutingDebug("OPTIMIZE_REQUEST", {
        optimizationId,
        problem,
        extra: {
          addressResolutionStats,
          blockingIssueCount,
        },
      });
      const response = await optimizeRoutingProblem(problem, { optimizationId });
      traceRoutingDebug("OPTIMIZE_RESPONSE", {
        optimizationId: response.optimizationId ?? optimizationId,
        problem: response.problem ?? problem,
        extra: {
          routeGeometries: response.routeGeometries.length,
          routes: response.result.routes.length,
          status: response.status,
          vehiclesUsed: response.result.vehiclesUsed,
        },
      });

      if (response.problem) {
        setProblem({
          ...response.problem,
          status: response.status === "time_limit" ? "failed" : "completed",
        });
      }

      setProgressTiming(response.debugTiming ?? null);
      setProgressOutcome(response.status);
      setProgressFailureCode(null);
      setOptimizationDebugTiming(response.debugTiming ?? null);
      setDiagnostics(response.diagnostics ?? null);
      setOptimizationId(response.optimizationId ?? null);
      setResult(response.result);
      setRouteGeometries(response.routeGeometries);
      setRouteGeometryError(response.routeGeometryError ?? null);
      window.setTimeout(() => {
        router.push("/results");
      }, response.status === "completed" ? 650 : 1800);
    } catch (error) {
      const apiError = error instanceof OptimizationApiError ? error : null;
      const responseProblem = apiError?.response?.problem;
      const locations = apiError?.failure?.locations ?? [];
      traceRoutingDebug("OPTIMIZE_ERROR", {
        optimizationId: apiError?.response?.optimizationId ?? optimizationId,
        problem: responseProblem ?? problem,
        extra: {
          errorCode: apiError?.failure?.code ?? null,
          errorMessage: apiError?.message ?? String(error),
          locations,
          responseStatus: apiError?.response?.status ?? null,
        },
      });

      if (responseProblem) {
        setProblem({ ...responseProblem, status: "failed" });
      } else {
        updateProblem({ status: "failed" });
      }

      applyLocationResolution(locations);
      setProgressTiming(apiError?.response?.debugTiming ?? null);
      setProgressOutcome("failed");
      setProgressFailureCode(apiError?.failure?.code ?? null);
      setOptimizationDebugTiming(apiError?.response?.debugTiming ?? null);
      setDiagnostics(null);
      setOptimizationId(apiError?.response?.optimizationId ?? null);
      setFailedLocations(locations.map(toFailedLocation));
      setOptimizationError(
        apiError?.failure?.message ??
          "Optimization could not be completed. Please try again in a moment.",
      );
      setOptimizationStatus("failed");
    } finally {
      optimizeInFlightRef.current = false;
    }
  }

  function applyLocationResolution(locations: OptimizationFailureLocation[]) {
    locations.forEach((location) => {
      const needsReview = location.status === "needs_review";
      const patch = needsReview
        ? {
            formattedAddress: location.formattedAddress,
            geocodingConfidence: location.confidence,
            geocodingConfirmed: undefined,
            geocodingMatchType: location.matchType,
            geocodingStatus: "needs_review" as const,
            latitude: location.latitude,
            longitude: location.longitude,
          }
        : {
            formattedAddress: undefined,
            geocodingConfidence: undefined,
            geocodingConfirmed: undefined,
            geocodingMatchType: undefined,
            geocodingStatus:
              location.status === "not_found"
                ? ("not_found" as const)
                : ("failed" as const),
            latitude: undefined,
            longitude: undefined,
          };

      if (location.kind === "depot") {
        updateDepot(patch);
      } else {
        updateStop(location.id, patch);
      }
    });
  }

  function handleFailedAddressChange(location: FailedLocation, address: string) {
    setFailedLocations((currentLocations) =>
      currentLocations.map((currentLocation) =>
        currentLocation.key === location.key
          ? { ...currentLocation, address }
          : currentLocation,
      ),
    );

    if (location.kind === "depot") {
      updateDepot({
        address,
        formattedAddress: undefined,
        geocodingConfidence: undefined,
        geocodingConfirmed: undefined,
        geocodingCountryCode: undefined,
        geocodingCity: undefined,
        geocodingMatchType: undefined,
        geocodingPostcode: undefined,
        geocodingProvider: undefined,
        geocodingStatus: undefined,
        latitude: undefined,
        longitude: undefined,
      });
    } else {
      updateStop(location.id, {
        address,
        formattedAddress: undefined,
        geocodingConfidence: undefined,
        geocodingConfirmed: undefined,
        geocodingCountryCode: undefined,
        geocodingCity: undefined,
        geocodingMatchType: undefined,
        geocodingPostcode: undefined,
        geocodingProvider: undefined,
        geocodingStatus: undefined,
        latitude: undefined,
        longitude: undefined,
      });
    }
  }

  function handleUseSuggestedLocation(location: FailedLocation) {
    if (
      location.status !== "needs_review" ||
      typeof location.latitude !== "number" ||
      typeof location.longitude !== "number"
    ) {
      return;
    }

    const patch = {
      formattedAddress: location.formattedAddress,
      geocodingConfirmed: true,
      geocodingStatus: "resolved" as const,
      latitude: location.latitude,
      longitude: location.longitude,
    };

    if (location.kind === "depot") {
      updateDepot(patch);
    } else {
      updateStop(location.id, patch);
    }

    setFailedLocations((currentLocations) =>
      currentLocations.filter(
        (currentLocation) => currentLocation.key !== location.key,
      ),
    );
  }

  return (
    <aside className="sticky top-24 rounded-lg border border-border bg-card p-6 shadow-[0_4px_12px_rgba(0,0,0,0.03)]">
      <h3 className="mb-6 border-b border-border pb-4 font-display text-2xl font-medium text-foreground">
        Generate optimization
      </h3>
      <ul className="mb-6 flex flex-col gap-4">
        {[
          ["Total Stops", String(stops.length)],
          ["Available Vehicles", String(vehicles.length)],
          ...(costOptimizationActive
            ? [
                [
                  "Vehicle costs configured",
                  `${configuredCostCount} / ${vehicles.length}`,
                ],
              ]
            : []),
          ["Time Windows", String(timeWindowCount)],
          ["Depot", formatLocationAddress(depot)],
        ].map(([label, value]) => (
          <li className="flex items-center justify-between" key={label}>
            <span className="text-base text-muted-foreground">{label}</span>
            <span className="font-display text-sm font-medium text-foreground">
              {value}
            </span>
          </li>
        ))}
        <li className="flex items-start justify-between border-t border-border pt-4">
          <span className="text-base text-muted-foreground">
            Optimization strategy
          </span>
          <span className="text-right">
            <span className="block font-display text-sm font-medium text-primary-accent">
              {formatOptimizationStrategy(strategy)}
            </span>
            {strategyDescription.lines.length > 0 && strategy?.mode !== "preset" ? (
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                {strategyDescription.lines.slice(0, 4).join(" | ")}
              </span>
            ) : null}
          </span>
        </li>
      </ul>

      <div className="mb-6 rounded-md border border-border bg-surface-low p-3">
        <p className="flex items-start gap-2 text-sm leading-6 text-muted-foreground">
          <Ticket
            aria-hidden
            className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
          />
          <span>
            This optimization will use{" "}
            <strong className="text-foreground">1 credit</strong>. Your plan:
            14 of 30 remaining.
          </span>
        </p>
      </div>

      <AddressResolutionStatus stats={addressResolutionStats} />

      <button
        className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary-accent px-4 py-3.5 font-display text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={!readiness.readyForOptimization || isOptimizing}
        onClick={handleOptimize}
        type="button"
      >
        {isOptimizing ? "Preparing route plan..." : "Generate optimized plan"}
        <Rocket aria-hidden className="h-4 w-4" />
      </button>
      {isOptimizing ? (
        <OptimizationProgressStatus />
      ) : null}
      <OptimizationProgressModal
        elapsedMs={progressElapsedMs}
        isOpen={isOptimizing || progressOutcome !== "running"}
        onClose={() => {
          if (!isOptimizing) {
            setProgressOutcome("running");
            setProgressFailureCode(null);
            setProgressTiming(null);
          }
        }}
        outcome={progressOutcome}
        failureCode={progressFailureCode}
        timing={progressTiming}
      />
      {optimizationStatus === "failed" && optimizationError ? (
        <p className="mb-3 text-center text-sm leading-6 text-destructive">
          {optimizationError}
        </p>
      ) : null}
      {failedLocations.length > 0 ? (
        <FailedLocationsPanel
          locations={failedLocations}
          onAddressChange={handleFailedAddressChange}
          onUseSuggested={handleUseSuggestedLocation}
          onRetry={handleOptimize}
        />
      ) : null}
      {readiness.readyForOptimization ? (
        <p className="text-center text-sm leading-6 text-muted-foreground">
          RoutesPilot will now calculate the best feasible plan based on these
          constraints.
        </p>
      ) : (
        <div className="text-center text-sm leading-6 text-muted-foreground">
          <p>{blockingIssueCount} details need attention before optimizing.</p>
          <Link
            className="font-display font-semibold text-primary"
            href="/optimize"
          >
            Back to conversation
          </Link>
        </div>
      )}
    </aside>
  );
}

function hasPositiveOperatingCost(cost?: VehicleOperatingCost) {
  if (!cost) {
    return false;
  }

  return [
    cost.fixedCost,
    cost.costPerKm,
    cost.costPerHour,
    cost.overtimeCostPerHour,
  ].some((value) => typeof value === "number" && value > 0);
}

type FailedLocation = {
  id: string;
  kind: "depot" | "stop";
  key: string;
  label: string;
  address: string;
  status?: OptimizationFailureLocation["status"];
  formattedAddress?: string;
  latitude?: number;
  longitude?: number;
  confidence?: number;
  matchType?: string;
  code?: string;
  message?: string;
};

type AddressResolutionStats = {
  pending: number;
  resolved: number;
  needsReview: number;
  unresolved: number;
  total: number;
};

type OptimizationProgressOutcome =
  | "running"
  | "completed"
  | "infeasible"
  | "time_limit"
  | "failed";

type OptimizationProgressStage = {
  key: keyof OptimizationDebugTiming;
  label: string;
  detail: string;
};

const optimizationProgressStages: OptimizationProgressStage[] = [
  {
    key: "validationMs",
    label: "Checking route data",
    detail: "Depot, deliveries, vehicles, capacities, and strategy.",
  },
  {
    key: "geocodingMs",
    label: "Resolving addresses",
    detail: "Missing coordinates are resolved on the backend.",
  },
  {
    key: "matrixMs",
    label: "Calculating travel times",
    detail: "Geoapify route matrix is built and validated.",
  },
  {
    key: "preSolveDiagnosticsMs",
    label: "Checking obvious conflicts",
    detail: "Capacity, reachability, and time-window diagnostics.",
  },
  {
    key: "solverMs",
    label: "Optimizing with OR-Tools",
    detail: "RoutesPilot searches for a feasible vehicle plan.",
  },
  {
    key: "geometryMs",
    label: "Preparing map routes",
    detail: "Road geometry is generated only after a feasible plan.",
  },
];

function OptimizationProgressModal({
  elapsedMs,
  failureCode,
  isOpen,
  onClose,
  outcome,
  timing,
}: {
  elapsedMs: number;
  failureCode: OptimizationFailure["code"] | null;
  isOpen: boolean;
  onClose: () => void;
  outcome: OptimizationProgressOutcome;
  timing: OptimizationDebugTiming | null;
}) {
  if (!isOpen) {
    return null;
  }

  const isRunning = outcome === "running";
  const outcomeCopy = optimizationOutcomeCopy(outcome, timing, failureCode);
  const activeStageIndex = getActiveOptimizationStageIndex(elapsedMs, timing);
  const failedStageIndex = getFailedOptimizationStageIndex(timing, failureCode);

  return (
    <div
      aria-labelledby="optimization-progress-title"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 py-6 backdrop-blur-sm"
      role="dialog"
    >
      <section className="w-full max-w-2xl rounded-xl border border-border bg-card shadow-[0_24px_80px_rgba(0,0,0,0.22)]">
        <div className="border-b border-border p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-display text-xs font-semibold uppercase text-muted-foreground">
                Optimization pipeline
              </p>
              <h2
                className="mt-1 font-display text-2xl font-semibold text-foreground"
                id="optimization-progress-title"
              >
                {outcomeCopy.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {outcomeCopy.description}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-surface-low px-3 py-2 text-right">
              <p className="font-display text-xs font-semibold uppercase text-muted-foreground">
                Elapsed
              </p>
              <p className="font-display text-lg font-semibold text-foreground">
                {formatMilliseconds(elapsedMs || timing?.totalMs)}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 p-5">
          {optimizationProgressStages.map((stage, index) => (
            <OptimizationProgressStageRow
              isActive={isRunning && index === activeStageIndex}
              isFailed={outcome === "failed" && index === failedStageIndex}
              key={stage.key}
              outcome={outcome}
              stage={stage}
              timing={timing}
            />
          ))}
        </div>

        <div className="border-t border-border bg-surface-low p-5">
          <div className="grid gap-3 text-sm leading-6 text-muted-foreground sm:grid-cols-3">
            <DebugTimingLine label="Trace" value={timing?.traceId ?? "-"} />
            <DebugTimingLine
              label="Solver status"
              value={solverStatusLabel(timing, failureCode)}
            />
            <DebugTimingLine
              label="Solver limit"
              value={
                typeof timing?.effectiveSolverLimitSeconds === "number"
                  ? `${timing.effectiveSolverLimitSeconds}s`
                  : "waiting"
              }
            />
          </div>
          {isRunning ? (
            <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <LoaderCircle
                aria-hidden
                className="h-4 w-4 animate-spin text-primary-accent"
              />
              The backend is working. Exact phase timings appear when the
              response returns.
            </p>
          ) : (
            <button
              className="mt-4 rounded-lg border border-border bg-card px-4 py-2 font-display text-sm font-medium text-foreground transition-colors hover:bg-surface"
              onClick={onClose}
              type="button"
            >
              Close
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

function OptimizationProgressStageRow({
  isActive,
  isFailed,
  outcome,
  stage,
  timing,
}: {
  isActive: boolean;
  isFailed: boolean;
  outcome: OptimizationProgressOutcome;
  stage: OptimizationProgressStage;
  timing: OptimizationDebugTiming | null;
}) {
  const rawDuration = timing?.[stage.key];
  const duration = typeof rawDuration === "number" ? rawDuration : undefined;
  const hasActualTiming = typeof duration === "number";
  const isSolverTimeout =
    outcome === "time_limit" && stage.key === "solverMs";

  return (
    <div className="grid grid-cols-[auto_1fr_auto] gap-3 rounded-lg border border-border bg-surface-low p-3">
      <div className="pt-0.5">
        {hasActualTiming && !isSolverTimeout ? (
          <CheckCircle2
            aria-hidden
            className="h-5 w-5 text-primary-accent"
          />
        ) : isSolverTimeout || isFailed ? (
          <TriangleAlert aria-hidden className="h-5 w-5 text-amber-500" />
        ) : isActive ? (
          <LoaderCircle
            aria-hidden
            className="h-5 w-5 animate-spin text-primary-accent"
          />
        ) : (
          <Clock aria-hidden className="h-5 w-5 text-muted-foreground" />
        )}
      </div>
      <div>
        <p className="font-display text-sm font-semibold text-foreground">
          {stage.label}
        </p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          {stage.detail}
        </p>
      </div>
      <p className="font-display text-sm font-semibold text-foreground">
        {hasActualTiming ? formatMilliseconds(duration) : isActive ? "running" : "-"}
      </p>
    </div>
  );
}

function DebugTimingLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="font-display text-xs font-semibold uppercase text-muted-foreground">
        {label}
      </p>
      <p className="truncate font-display text-sm font-medium text-foreground">
        {value}
      </p>
    </div>
  );
}

function optimizationOutcomeCopy(
  outcome: OptimizationProgressOutcome,
  timing: OptimizationDebugTiming | null,
  failureCode: OptimizationFailure["code"] | null,
) {
  if (outcome === "completed") {
    return {
      title: "Route plan calculated",
      description: "RoutesPilot found a feasible plan and is opening Results.",
    };
  }

  if (outcome === "time_limit") {
    const limit = timing?.effectiveSolverLimitSeconds;

    return {
      title: "Optimization time limit reached",
      description:
        typeof limit === "number"
          ? `OR-Tools used the configured ${limit}s solver limit without returning a feasible plan.`
          : "OR-Tools reached the configured solver limit without returning a feasible plan.",
    };
  }

  if (outcome === "infeasible") {
    return {
      title: "No feasible route found",
      description:
        "RoutesPilot found deterministic conflicts before or after solving.",
    };
  }

  if (outcome === "failed") {
    if (
      failureCode === "UNRESOLVED_LOCATIONS" ||
      failureCode === "ADDRESS_NEEDS_REVIEW"
    ) {
      return {
        title: "Address review required",
        description:
          "RoutesPilot resolved plausible matches, but needs confirmation before calculating travel times. OR-Tools has not started yet.",
      };
    }

    return {
      title: "Optimization stopped",
      description:
        "The pipeline returned an error before a route plan could be produced.",
    };
  }

  return {
    title: "Calculating route plan",
    description:
      "RoutesPilot is validating the plan, preparing locations, calculating travel times, and running the solver.",
  };
}

function getFailedOptimizationStageIndex(
  timing: OptimizationDebugTiming | null,
  failureCode: OptimizationFailure["code"] | null,
) {
  if (
    failureCode === "UNRESOLVED_LOCATIONS" ||
    failureCode === "ADDRESS_NEEDS_REVIEW"
  ) {
    return optimizationProgressStages.findIndex(
      (stage) => stage.key === "geocodingMs",
    );
  }

  return firstMissingTimingIndex(timing);
}

function solverStatusLabel(
  timing: OptimizationDebugTiming | null,
  failureCode: OptimizationFailure["code"] | null,
) {
  if (
    failureCode === "UNRESOLVED_LOCATIONS" ||
    failureCode === "ADDRESS_NEEDS_REVIEW"
  ) {
    return "not started";
  }

  return timing?.normalizedSolverStatus ?? timing?.ortoolsStatus ?? "-";
}

function getActiveOptimizationStageIndex(
  elapsedMs: number,
  timing: OptimizationDebugTiming | null,
) {
  if (timing) {
    const missingIndex = firstMissingTimingIndex(timing);

    return missingIndex === -1 ? optimizationProgressStages.length - 1 : missingIndex;
  }

  if (elapsedMs < 1000) {
    return 0;
  }

  if (elapsedMs < 7000) {
    return 1;
  }

  if (elapsedMs < 14000) {
    return 2;
  }

  if (elapsedMs < 17000) {
    return 3;
  }

  return 4;
}

function firstMissingTimingIndex(timing: OptimizationDebugTiming | null) {
  if (!timing) {
    return 0;
  }

  return optimizationProgressStages.findIndex(
    (stage) => typeof timing[stage.key] !== "number",
  );
}

function formatMilliseconds(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "0 ms";
  }

  if (value < 1000) {
    return `${Math.max(0, Math.round(value))} ms`;
  }

  return `${(value / 1000).toFixed(value < 10000 ? 1 : 0)} s`;
}

function OptimizationProgressStatus() {
  const stages = [
    "Preparing locations",
    "Calculating travel times",
    "Optimizing routes",
  ];

  return (
    <div className="mb-4 rounded-md border border-border bg-surface-low p-3 text-sm leading-6 text-muted-foreground">
      <p className="mb-2 flex items-center gap-2 font-display font-medium text-foreground">
        <MapPin aria-hidden className="h-4 w-4 text-primary-accent" />
        Preparing your route plan
      </p>
      <div className="flex flex-col gap-1.5">
        {stages.map((stage, index) => (
          <p className="flex items-center gap-2" key={stage}>
            {index === 0 ? (
              <CheckCircle2
                aria-hidden
                className="h-4 w-4 text-primary-accent"
              />
            ) : (
              <span className="h-4 w-4 rounded-full border border-primary-accent" />
            )}
            {stage}
          </p>
        ))}
      </div>
    </div>
  );
}

function toFailedLocation(location: OptimizationFailureLocation): FailedLocation {
  return {
    id: location.id,
    kind: location.kind,
    key: location.kind === "depot" ? "depot" : location.id,
    label: location.label,
    address: location.address,
    status: location.status,
    formattedAddress: location.formattedAddress,
    latitude: location.latitude,
    longitude: location.longitude,
    confidence: location.confidence,
    matchType: location.matchType,
    code: location.code,
    message: location.message,
  };
}

function AddressResolutionStatus({ stats }: { stats: AddressResolutionStats }) {
  const hasCheckedLocations =
    stats.resolved > 0 || stats.needsReview > 0 || stats.unresolved > 0;

  return (
    <div className="mb-4 rounded-md border border-border bg-surface-low p-3 text-sm leading-6 text-muted-foreground">
      <p className="mb-2 flex items-center gap-2 font-display font-medium text-foreground">
        <MapPin aria-hidden className="h-4 w-4 text-primary-accent" />
        Locations
      </p>
      {hasCheckedLocations ? (
        <div className="grid gap-2">
          <StatusLine
            healthy={stats.resolved > 0}
            label={`${stats.resolved} resolved`}
          />
          <StatusLine
            healthy={stats.needsReview === 0}
            label={`${stats.needsReview} need review`}
          />
          <StatusLine
            healthy={stats.unresolved === 0}
            label={`${stats.unresolved} unresolved`}
          />
        </div>
      ) : (
        <p>Addresses will be checked before optimization.</p>
      )}
    </div>
  );
}

function FailedLocationsPanel({
  locations,
  onAddressChange,
  onUseSuggested,
  onRetry,
}: {
  locations: FailedLocation[];
  onAddressChange: (location: FailedLocation, address: string) => void;
  onUseSuggested: (location: FailedLocation) => void;
  onRetry: () => void;
}) {
  const needsReviewCount = locations.filter(
    (location) => location.status === "needs_review",
  ).length;

  return (
    <div className="mb-4 rounded-md border border-border bg-surface-low p-3">
      <p className="mb-3 flex items-center gap-2 font-display text-sm font-semibold text-foreground">
        <AlertCircle aria-hidden className="h-4 w-4 text-amber-500" />
        {locations.length} addresses need attention
      </p>
      {needsReviewCount > 0 ? (
        <p className="mb-3 text-sm leading-6 text-muted-foreground">
          {needsReviewCount} matches look plausible but need confirmation before
          travel times are calculated.
        </p>
      ) : null}
      <div className="flex flex-col gap-3">
        {locations.map((location) => (
          <div
            className="rounded-md border border-border bg-card p-3"
            key={location.key}
          >
            <p className="font-display text-xs font-medium text-muted-foreground">
              {location.label}
            </p>
            <p className="mt-1 text-sm leading-6 text-foreground">
              {location.address}
            </p>
            {location.status === "needs_review" &&
            location.formattedAddress ? (
              <div className="mt-3 rounded-md border border-amber-500/20 bg-amber-500/10 p-3 text-sm leading-6 text-muted-foreground">
                <p className="font-display text-xs font-semibold uppercase text-foreground">
                  Suggested match
                </p>
                <p className="mt-1">{location.formattedAddress}</p>
                <button
                  className="mt-3 rounded-lg border border-border bg-surface px-3 py-2 font-display text-xs font-medium text-foreground transition-colors hover:bg-surface-container"
                  onClick={() => onUseSuggested(location)}
                  type="button"
                >
                  Use this location
                </button>
              </div>
            ) : null}
            <label className="mt-3 flex flex-col gap-1">
              <span className="font-display text-xs font-medium text-muted-foreground">
                Edit address
              </span>
              <input
                className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary-accent focus:ring-2 focus:ring-primary-accent/10"
                onChange={(event) =>
                  onAddressChange(location, event.target.value)
                }
                value={location.address}
              />
            </label>
            {location.message ? (
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                {location.message}
              </p>
            ) : null}
          </div>
        ))}
      </div>
      <button
        className="mt-4 w-full rounded-lg border border-border bg-surface px-4 py-2.5 font-display text-sm font-medium text-foreground transition-colors hover:bg-surface-container"
        onClick={onRetry}
        type="button"
      >
        Retry address check
      </button>
    </div>
  );
}

function getAddressResolutionStats(problem: {
  depot?: GeoLocation;
  stops: GeoLocation[];
}): AddressResolutionStats {
  const locations = [problem.depot, ...problem.stops].filter(
    Boolean,
  ) as GeoLocation[];

  return locations.reduce<AddressResolutionStats>(
    (stats, location) => {
      const state = getAddressResolutionState(location);

      const nextStats = {
        ...stats,
        total: stats.total + 1,
      };

      nextStats[state] += 1;

      return nextStats;
    },
    {
      pending: 0,
      resolved: 0,
      needsReview: 0,
      unresolved: 0,
      total: 0,
    },
  );
}

function getAddressResolutionState(
  location: GeoLocation,
): keyof Omit<AddressResolutionStats, "total"> {
  if (location.geocodingStatus === "needs_review") {
    return "needsReview";
  }

  if (
    location.geocodingStatus === "failed" ||
    location.geocodingStatus === "not_found"
  ) {
    return "unresolved";
  }

  if (
    location.geocodingStatus === "resolved" ||
    (typeof location.latitude === "number" && typeof location.longitude === "number")
  ) {
    return "resolved";
  }

  return "pending";
}

function StatusLine({ healthy, label }: { healthy: boolean; label: string }) {
  return (
    <p className="flex items-center gap-2">
      {healthy ? (
        <CheckCircle2 aria-hidden className="h-4 w-4 text-primary-accent" />
      ) : (
        <AlertCircle aria-hidden className="h-4 w-4 text-amber-500" />
      )}
      {label}
    </p>
  );
}
