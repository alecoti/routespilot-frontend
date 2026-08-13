"use client";

import Link from "next/link";
import { AlertCircle, ArrowLeft, TriangleAlert } from "lucide-react";

import { StatusBadge } from "@/components/ui/status-badge";
import type {
  DiagnosticIssue,
  InfeasibilityDiagnostics,
  OptimizationDebugTiming,
  RoutingProblem,
  RoutingResult,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const issueTitles: Record<string, string> = {
  INSUFFICIENT_TOTAL_CAPACITY: "Capacity insufficient",
  STOP_EXCEEDS_VEHICLE_CAPACITY: "Delivery exceeds vehicle capacity",
  MISSING_VEHICLE_CAPACITY: "Vehicle capacity missing",
  TOO_FEW_VEHICLES_FOR_CAPACITY: "Too few vehicles",
  UNREACHABLE_STOP: "Stop unreachable",
  INVALID_TIME_WINDOW: "Invalid time window",
  SERVICE_TIME_EXCEEDS_WINDOW: "Service time too long",
  TIME_WINDOW_UNREACHABLE_FROM_DEPOT: "Time window unreachable",
  PAIRWISE_TIME_WINDOW_CONFLICT: "Time-window ordering conflict",
  SOLVER_TIME_LIMIT_REACHED: "Optimization time limit reached",
  NO_FEASIBLE_SOLUTION_FOUND: "No feasible combination found",
};

export function InfeasibilityDiagnosticsPanel({
  debugTiming,
  diagnostics,
  problem,
  result,
}: {
  debugTiming?: OptimizationDebugTiming | null;
  diagnostics: InfeasibilityDiagnostics | null;
  problem: RoutingProblem;
  result: RoutingResult;
}) {
  const issues =
    diagnostics?.issues.length ? diagnostics.issues : fallbackIssues(result);
  const title =
    result.solverStatus === "time_limit"
      ? "Optimization time limit reached"
      : "No feasible route found";
  const subtitle =
    result.solverStatus === "time_limit"
      ? "RoutesPilot could not find a route plan within the current optimization time limit."
      : "RoutesPilot found conflicts in the current plan.";

  return (
    <div className="mx-auto flex max-w-[1440px] flex-col gap-8 px-4 py-8 md:px-6 md:py-10">
      <header className="flex flex-col justify-between gap-4 border-b border-border pb-4 md:flex-row md:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-3xl font-semibold text-foreground md:text-4xl">
              {title}
            </h1>
            <StatusBadge className="border-destructive/20 bg-destructive/10 text-destructive">
              Needs review
            </StatusBadge>
          </div>
          <p className="mt-2 text-base text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 font-display text-sm font-medium text-foreground transition-colors hover:bg-surface-low"
            href="/review"
          >
            <ArrowLeft aria-hidden className="h-4 w-4" />
            Back to Review
          </Link>
          <Link
            className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 font-display text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            href="/optimize"
          >
            Edit constraints
          </Link>
        </div>
      </header>

      <section className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="grid gap-4">
          {issues.map((issue, index) => (
            <DiagnosticIssueCard
              issue={issue}
              key={`${issue.code}-${index}`}
              problem={problem}
            />
          ))}
        </div>

        <aside className="rounded-lg border border-border bg-card p-5">
          <h2 className="font-display text-lg font-semibold text-foreground">
            Suggested next steps
          </h2>
          <div className="mt-4 flex flex-col gap-3">
            {(diagnostics?.suggestions.length
              ? diagnostics.suggestions
              : [
                  {
                    code: "REVIEW_CONSTRAINTS",
                    message:
                      "Review vehicles, capacities, stops, and time windows before retrying.",
                  },
                ]
            ).map((suggestion) => (
              <p
                className="rounded-md border border-border bg-surface-low px-3 py-2 text-sm leading-6 text-muted-foreground"
                key={suggestion.code}
              >
                {suggestion.message}
              </p>
            ))}
          </div>
          {debugTiming ? <OptimizationTimingPanel timing={debugTiming} /> : null}
        </aside>
      </section>
    </div>
  );
}

function OptimizationTimingPanel({
  timing,
}: {
  timing: OptimizationDebugTiming;
}) {
  const rows = [
    ["Validation", timing.validationMs],
    ["Geocoding", timing.geocodingMs],
    ["Route matrix", timing.matrixMs],
    ["Diagnostics", timing.preSolveDiagnosticsMs],
    ["Solver", timing.solverMs],
    ["Geometry", timing.geometryMs],
    ["Total", timing.totalMs],
  ] as const;

  return (
    <div className="mt-5 border-t border-border pt-5">
      <h3 className="font-display text-sm font-semibold uppercase text-muted-foreground">
        Calculation trace
      </h3>
      <dl className="mt-3 grid gap-2">
        {rows.map(([label, value]) => (
          <div
            className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface-low px-3 py-2 text-sm"
            key={label}
          >
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-display font-semibold text-foreground">
              {formatMilliseconds(value)}
            </dd>
          </div>
        ))}
      </dl>
      <div className="mt-3 grid gap-2 text-xs leading-5 text-muted-foreground">
        <p>
          Solver status:{" "}
          <span className="font-display font-semibold text-foreground">
            {timing.normalizedSolverStatus ?? timing.ortoolsStatus ?? "-"}
          </span>
        </p>
        <p>
          Solver limit:{" "}
          <span className="font-display font-semibold text-foreground">
            {typeof timing.effectiveSolverLimitSeconds === "number"
              ? `${timing.effectiveSolverLimitSeconds}s`
              : "-"}
          </span>
        </p>
        {timing.traceId ? (
          <p className="break-all">
            Trace:{" "}
            <span className="font-display font-semibold text-foreground">
              {timing.traceId}
            </span>
          </p>
        ) : null}
      </div>
    </div>
  );
}

function DiagnosticIssueCard({
  issue,
  problem,
}: {
  issue: DiagnosticIssue;
  problem: RoutingProblem;
}) {
  const affectedStops = issue.affectedStopIds
    .map((stopId) => problem.stops.find((stop) => stop.id === stopId))
    .filter(isDefined);
  const affectedVehicles = issue.affectedVehicleIds
    .map((vehicleId) =>
      problem.vehicles.find((vehicle) => vehicle.id === vehicleId),
    )
    .filter(isDefined);
  const metricRows = getMetricRows(issue);

  return (
    <article
      className={cn(
        "rounded-lg border bg-card p-5",
        issue.severity === "error"
          ? "border-destructive/20"
          : "border-amber-500/20",
      )}
    >
      <div className="flex items-start gap-3">
        {issue.severity === "error" ? (
          <TriangleAlert
            aria-hidden
            className="mt-0.5 h-5 w-5 shrink-0 text-destructive"
          />
        ) : (
          <AlertCircle
            aria-hidden
            className="mt-0.5 h-5 w-5 shrink-0 text-amber-500"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-lg font-semibold text-foreground">
              {issueTitles[issue.code] ?? issue.code}
            </h2>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 font-display text-xs font-semibold uppercase",
                issue.severity === "error"
                  ? "bg-destructive/10 text-destructive"
                  : "bg-amber-500/10 text-amber-700",
              )}
            >
              {issue.severity}
            </span>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {issue.message}
          </p>

          {metricRows.length > 0 ? (
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              {metricRows.map((row) => (
                <div
                  className="rounded-md border border-border bg-surface-low px-3 py-2"
                  key={row.label}
                >
                  <dt className="font-display text-xs font-semibold uppercase text-muted-foreground">
                    {row.label}
                  </dt>
                  <dd className="mt-1 font-display text-base font-semibold text-foreground">
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}

          {affectedStops.length > 0 ? (
            <div className="mt-4">
              <p className="font-display text-xs font-semibold uppercase text-muted-foreground">
                Affected stops
              </p>
              <div className="mt-2 grid gap-2">
                {affectedStops.map((stop) => (
                  <div
                    className="rounded-md border border-border bg-surface-low px-3 py-2 text-sm"
                    key={stop.id}
                  >
                    <p className="font-display font-medium text-foreground">
                      {stop.name}
                    </p>
                    <p className="mt-1 text-muted-foreground">{stop.address}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {affectedVehicles.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {affectedVehicles.map((vehicle) => (
                <span
                  className="rounded-full border border-border bg-surface px-3 py-1 font-display text-xs font-medium text-foreground"
                  key={vehicle.id}
                >
                  {vehicle.name}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function getMetricRows(issue: DiagnosticIssue) {
  const details = issue.details;

  if (issue.code === "INSUFFICIENT_TOTAL_CAPACITY") {
    return [
      {
        label: "Required",
        value: formatKg(readNumber(details.required_load)),
      },
      {
        label: "Available",
        value: formatKg(readNumber(details.available_capacity)),
      },
    ];
  }

  if (issue.code === "STOP_EXCEEDS_VEHICLE_CAPACITY") {
    return [
      {
        label: "Delivery load",
        value: formatKg(readNumber(details.stop_demand)),
      },
      {
        label: "Largest vehicle",
        value: formatKg(readNumber(details.largest_vehicle_capacity)),
      },
    ];
  }

  if (issue.code === "SERVICE_TIME_EXCEEDS_WINDOW") {
    return [
      {
        label: "Service time",
        value: formatDuration(readNumber(details.service_time_seconds)),
      },
      {
        label: "Window length",
        value: formatDuration(readNumber(details.window_duration_seconds)),
      },
    ];
  }

  if (issue.code === "TIME_WINDOW_UNREACHABLE_FROM_DEPOT") {
    return [
      {
        label: "Earliest arrival",
        value: formatTime(readNumber(details.earliest_arrival_seconds)),
      },
      {
        label: "Window closes",
        value: formatTime(readNumber(details.window_end_seconds)),
      },
    ];
  }

  if (issue.code === "TOO_FEW_VEHICLES_FOR_CAPACITY") {
    return [
      {
        label: "Required vehicles",
        value: String(readNumber(details.required_vehicle_lower_bound) ?? "-"),
      },
      {
        label: "Configured",
        value: String(readNumber(details.configured_vehicle_count) ?? "-"),
      },
    ];
  }

  if (issue.code === "SOLVER_TIME_LIMIT_REACHED") {
    const solveTimeMs = readNumber(details.solve_time_ms);

    return [
      {
        label: "Solver time",
        value: formatDuration(
          typeof solveTimeMs === "number" ? solveTimeMs / 1000 : undefined,
        ),
      },
    ];
  }

  return [];
}

function fallbackIssues(result: RoutingResult): DiagnosticIssue[] {
  return (
    result.warnings.length > 0 ? result.warnings : ["Review the current constraints."]
  ).map((warning) => ({
    code: "NO_FEASIBLE_SOLUTION_FOUND",
    severity: "error" as const,
    message: warning,
    affectedStopIds: [],
    affectedVehicleIds: [],
    details: {},
  }));
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

function formatKg(value?: number) {
  if (typeof value !== "number") {
    return "-";
  }

  return `${Math.round(value).toLocaleString("en-US")} kg`;
}

function formatTime(value?: number) {
  if (typeof value !== "number") {
    return "-";
  }

  const normalized = ((value % 86400) + 86400) % 86400;
  const hours = Math.floor(normalized / 3600);
  const minutes = Math.floor((normalized % 3600) / 60);

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function formatDuration(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "-";
  }

  if (value < 1) {
    return `${Math.max(0, Math.round(value * 1000))} ms`;
  }

  if (value < 60) {
    return `${value.toFixed(value < 10 ? 1 : 0)} s`;
  }

  const minutes = Math.max(0, Math.round(value / 60));
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours && remainingMinutes) {
    return `${hours}h ${remainingMinutes}m`;
  }

  if (hours) {
    return `${hours}h`;
  }

  return `${remainingMinutes}m`;
}

function formatMilliseconds(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "-";
  }

  if (value < 1000) {
    return `${Math.max(0, Math.round(value))} ms`;
  }

  return `${(value / 1000).toFixed(value < 10000 ? 1 : 0)} s`;
}
