"use client";

import { Percent, RefreshCcw } from "lucide-react";

import {
  getAdvancedWeightTotal,
  normalizeAdvancedWeights,
  objectiveDefinitions,
} from "@/lib/optimization-strategy";
import { cn } from "@/lib/utils";
import type { OptimizationObjectiveType, OptimizationStrategy } from "@/lib/types";

export function WeightEditor({
  onChange,
  strategy,
}: {
  onChange: (strategy: OptimizationStrategy) => void;
  strategy: OptimizationStrategy;
}) {
  const total = getAdvancedWeightTotal(strategy);
  const totalPercent = Math.round(total * 100);
  const isValidTotal = Math.abs(total - 1) <= 0.001;

  function updateWeight(type: OptimizationObjectiveType, percent: number) {
    const safePercent = Number.isFinite(percent)
      ? Math.max(0, Math.min(100, percent))
      : 0;

    onChange({
      ...strategy,
      mode: "advanced",
      preset: undefined,
      objectives: strategy.objectives.map((objective) =>
        objective.type === type
          ? {
              ...objective,
              enabled: true,
              weight: Number((safePercent / 100).toFixed(6)),
            }
          : objective,
      ),
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="font-display text-sm font-semibold text-foreground">
          Custom strategy
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Control how RoutesPilot balances competing goals.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface-low p-3">
        <p
          className={cn(
            "font-display text-sm font-semibold",
            isValidTotal ? "text-foreground" : "text-amber-700",
          )}
        >
          Total: {totalPercent}%
        </p>
        <button
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 font-display text-xs font-medium text-foreground transition-colors hover:bg-surface-container"
          onClick={() => onChange(normalizeAdvancedWeights(strategy))}
          type="button"
        >
          <RefreshCcw aria-hidden className="h-3.5 w-3.5" />
          Normalize to 100%
        </button>
      </div>

      {strategy.objectives.map((objective) => {
        const definition = objectiveDefinitions[objective.type];
        const percent = Math.round((objective.weight ?? 0) * 100);

        return (
          <div
            className="grid gap-3 rounded-lg border border-border bg-surface p-4"
            key={objective.type}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-display text-sm font-semibold text-foreground">
                  {definition.label}
                </p>
                <p className="text-sm leading-5 text-muted-foreground">
                  {definition.description}
                </p>
              </div>
              <label className="flex w-24 items-center gap-1 rounded-md border border-border bg-card px-2 py-1.5">
                <input
                  aria-label={`${definition.label} percentage`}
                  className="w-full bg-transparent text-right font-display text-sm font-semibold text-foreground outline-none"
                  max={100}
                  min={0}
                  onChange={(event) =>
                    updateWeight(objective.type, Number(event.target.value))
                  }
                  type="number"
                  value={percent}
                />
                <Percent
                  aria-hidden
                  className="h-3.5 w-3.5 text-muted-foreground"
                />
              </label>
            </div>
            <input
              aria-label={`${definition.label} weight`}
              className="w-full accent-primary-accent"
              max={100}
              min={0}
              onChange={(event) =>
                updateWeight(objective.type, Number(event.target.value))
              }
              type="range"
              value={percent}
            />
          </div>
        );
      })}
    </div>
  );
}
