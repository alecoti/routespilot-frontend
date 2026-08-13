import {
  describeOptimizationStrategy,
  getCurrentSolverObjective,
} from "@/lib/optimization-strategy";
import type { OptimizationStrategy } from "@/lib/types";

export function OptimizationStrategySummary({
  compact = false,
  strategy,
}: {
  compact?: boolean;
  strategy?: OptimizationStrategy;
}) {
  const summary = describeOptimizationStrategy(strategy);
  const currentSolverObjective = strategy
    ? getCurrentSolverObjective(strategy)
    : null;

  return (
    <div className="rounded-lg border border-border bg-surface-low p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-display text-sm font-semibold text-foreground">
            {summary.label}
          </p>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">
            {summary.detail}
          </p>
        </div>
        {currentSolverObjective ? (
          <span className="rounded-full border border-primary-accent/30 bg-primary-accent/10 px-2 py-1 font-display text-xs font-medium text-primary-accent">
            Engine v2
          </span>
        ) : null}
      </div>
      {!compact && summary.lines.length > 0 ? (
        <div className="mt-3 grid gap-1 text-sm leading-6 text-muted-foreground">
          {summary.lines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
