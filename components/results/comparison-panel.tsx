"use client";

import { useRef } from "react";
import { BarChart3, CheckCircle2, RefreshCw } from "lucide-react";

import { compareOptimizationPlans } from "@/lib/api/comparisons";
import { formatMoneyMinor } from "@/lib/formatters";
import type { ComparativePlan, ComparisonPlanMetrics } from "@/lib/types";
import { useOptimizationStore } from "@/providers/optimization-provider";

export function ComparisonPanel() {
  const inFlightRef = useRef(false);
  const problem = useOptimizationStore((state) => state.problem);
  const result = useOptimizationStore((state) => state.result);
  const optimizationId = useOptimizationStore((state) => state.optimizationId);
  const comparisonError = useOptimizationStore((state) => state.comparisonError);
  const comparisonPlans = useOptimizationStore((state) => state.comparisonPlans);
  const comparisonStatus = useOptimizationStore(
    (state) => state.comparisonStatus,
  );
  const recommendedPlanId = useOptimizationStore(
    (state) => state.recommendedComparisonPlanId,
  );
  const applyComparisonPlan = useOptimizationStore(
    (state) => state.applyComparisonPlan,
  );
  const setComparisonError = useOptimizationStore(
    (state) => state.setComparisonError,
  );
  const setComparisonResult = useOptimizationStore(
    (state) => state.setComparisonResult,
  );
  const setComparisonStatus = useOptimizationStore(
    (state) => state.setComparisonStatus,
  );

  if (!result?.feasible) {
    return null;
  }

  const isComparing = comparisonStatus === "comparing";

  async function handleCompare() {
    if (inFlightRef.current || isComparing) {
      return;
    }

    inFlightRef.current = true;
    setComparisonError(null);
    setComparisonStatus("comparing");

    try {
      const response = await compareOptimizationPlans(problem, optimizationId);

      setComparisonResult(response.plans, response.recommendedPlanId);
    } catch {
      setComparisonError("We couldn't compare alternatives. Please try again.");
      setComparisonStatus("failed");
    } finally {
      inFlightRef.current = false;
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <p className="font-display text-xs font-semibold uppercase text-muted-foreground">
            Alternatives
          </p>
          <h2 className="mt-1 font-display text-lg font-semibold text-foreground">
            Compare route strategies
          </h2>
        </div>
        <button
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 font-display text-sm font-medium text-foreground transition-colors hover:bg-surface-low disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isComparing}
          onClick={() => void handleCompare()}
          type="button"
        >
          {isComparing ? (
            <RefreshCw aria-hidden className="h-4 w-4 animate-spin" />
          ) : (
            <BarChart3 aria-hidden className="h-4 w-4" />
          )}
          {comparisonPlans.length > 0 ? "Refresh comparison" : "Compare alternatives"}
        </button>
      </div>

      {comparisonError ? (
        <p className="mt-3 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {comparisonError}
        </p>
      ) : null}

      {comparisonPlans.length > 0 ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-4">
          {comparisonPlans.map((plan) => (
            <ComparisonPlanCard
              isRecommended={plan.id === recommendedPlanId}
              key={plan.id}
              onUsePlan={() => applyComparisonPlan(plan)}
              plan={plan}
            />
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Run a lightweight comparison to see fastest, shortest, lowest-cost
          and balanced alternatives using the same locations and travel-time
          matrix.
        </p>
      )}
    </section>
  );
}

function ComparisonPlanCard({
  isRecommended,
  onUsePlan,
  plan,
}: {
  isRecommended: boolean;
  onUsePlan: () => void;
  plan: ComparativePlan;
}) {
  const isUsable = plan.status === "completed" && plan.result?.feasible;

  return (
    <article className="rounded-lg border border-border bg-surface p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-display text-sm font-semibold text-foreground">
            {plan.label}
          </h3>
          <p className="mt-1 text-xs font-medium uppercase text-muted-foreground">
            {formatStatus(plan.status)}
          </p>
        </div>
        {isRecommended ? (
          <span className="rounded-full bg-primary-accent/10 px-2 py-1 font-display text-xs font-semibold text-primary-accent">
            Recommended
          </span>
        ) : plan.isDominated ? (
          <span className="rounded-full bg-muted/10 px-2 py-1 font-display text-xs font-semibold text-muted-foreground">
            Less favorable
          </span>
        ) : null}
      </div>

      {plan.metrics ? (
        <ComparisonMetrics metrics={plan.metrics} />
      ) : (
        <p className="mt-4 min-h-16 text-sm leading-6 text-muted-foreground">
          {plan.unavailableMessage ?? "This alternative is not available."}
        </p>
      )}

      {plan.tradeoffs.length > 0 ? (
        <div className="mt-3 grid gap-1 text-xs leading-5 text-muted-foreground">
          {plan.tradeoffs.slice(0, 2).map((tradeoff) => (
            <p className="flex gap-2" key={tradeoff}>
              <CheckCircle2
                aria-hidden
                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary-accent"
              />
              {tradeoff}
            </p>
          ))}
        </div>
      ) : null}

      <button
        className="mt-4 w-full rounded-lg border border-border bg-card px-3 py-2 font-display text-xs font-semibold text-foreground transition-colors hover:bg-surface-container disabled:cursor-not-allowed disabled:text-muted-foreground"
        disabled={!isUsable}
        onClick={onUsePlan}
        type="button"
      >
        Use this plan
      </button>
    </article>
  );
}

function ComparisonMetrics({ metrics }: { metrics: ComparisonPlanMetrics }) {
  const items = [
    ["Vehicles", String(metrics.vehiclesUsed)],
    ["Distance", `${formatKilometers(metrics.totalDistanceMeters)} km`],
    ["Travel", formatSecondsDuration(metrics.totalTravelTimeSeconds)],
    [
      "Cost",
      typeof metrics.estimatedOperatingCostMinor === "number"
        ? formatMoneyMinor(metrics.estimatedOperatingCostMinor)
        : "-",
    ],
  ];

  return (
    <dl className="mt-4 grid grid-cols-2 gap-2">
      {items.map(([label, value]) => (
        <div className="rounded-md border border-border bg-card p-2" key={label}>
          <dt className="font-display text-[11px] font-semibold uppercase text-muted-foreground">
            {label}
          </dt>
          <dd className="mt-1 font-display text-sm font-semibold text-foreground">
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function formatStatus(status: ComparativePlan["status"]) {
  switch (status) {
    case "completed":
      return "Ready";
    case "infeasible":
      return "No feasible plan";
    case "time_limit":
      return "Time limit";
    case "unavailable":
      return "Needs setup";
    case "failed":
      return "Failed";
  }
}

function formatKilometers(meters: number) {
  return Number((meters / 1000).toFixed(1));
}

function formatSecondsDuration(seconds: number) {
  const minutes = Math.round(Math.max(0, seconds) / 60);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return hours > 0 ? `${hours}h ${remainingMinutes}m` : `${remainingMinutes}m`;
}
