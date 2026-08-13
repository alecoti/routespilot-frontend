"use client";

import { ClipboardCheck, ListOrdered, SlidersHorizontal, Sparkles } from "lucide-react";

import { PresetSelector } from "@/components/optimization-strategy/preset-selector";
import { PriorityEditor } from "@/components/optimization-strategy/priority-editor";
import { WeightEditor } from "@/components/optimization-strategy/weight-editor";
import {
  createAdvancedStrategy,
  createPresetStrategy,
  createPriorityStrategy,
  getEffectiveOptimizationStrategy,
  objectiveDefinitions,
  presetDefinitions,
  priorityObjectiveOrder,
  validateOptimizationStrategy,
} from "@/lib/optimization-strategy";
import { cn } from "@/lib/utils";
import { useOptimizationStore } from "@/providers/optimization-provider";
import type {
  OptimizationPreset,
  OptimizationStrategy,
  OptimizationStrategyMode,
} from "@/lib/types";

type FeatureAvailability = (mode: OptimizationStrategyMode) => boolean;

const modeOptions: Array<{
  description: string;
  icon: typeof Sparkles;
  label: string;
  value: OptimizationStrategyMode;
}> = [
  {
    description: "Simple business goals",
    icon: Sparkles,
    label: "Preset",
    value: "preset",
  },
  {
    description: "Choose what matters most, in order.",
    icon: ListOrdered,
    label: "Set priorities",
    value: "priority",
  },
  {
    description: "Balance goals with percentages.",
    icon: SlidersHorizontal,
    label: "Custom strategy",
    value: "advanced",
  },
];

export function OptimizationStrategySelector({
  isFeatureAvailable = () => true,
}: {
  isFeatureAvailable?: FeatureAvailability;
}) {
  const problem = useOptimizationStore((state) => state.problem);
  const setOptimizationStrategy = useOptimizationStore(
    (state) => state.setOptimizationStrategy,
  );
  const strategy = getEffectiveOptimizationStrategy(problem);
  const mode = strategy?.mode ?? "preset";
  const strategyIssues = validateOptimizationStrategy(strategy);
  const isUnsupportedPreset = Boolean(
    strategy?.mode === "preset" &&
      strategy.preset &&
      !presetDefinitions[strategy.preset].supportedByCurrentSolver,
  );
  const blockingStrategyIssues = strategyIssues.filter(
    (issue) =>
      issue.code !== "MISSING_OPTIMIZATION_STRATEGY" &&
      !(isUnsupportedPreset && issue.code === "UNSUPPORTED_OPTIMIZATION_STRATEGY"),
  );

  function handleModeChange(nextMode: OptimizationStrategyMode) {
    if (!isFeatureAvailable(nextMode)) {
      return;
    }

    if (nextMode === "preset") {
      setOptimizationStrategy(
        strategy?.mode === "preset"
          ? strategy
          : createPresetStrategy("fastest"),
      );
      return;
    }

    if (nextMode === "priority") {
      setOptimizationStrategy(
        strategy?.mode === "priority" ? strategy : createPriorityStrategy(),
      );
      return;
    }

    setOptimizationStrategy(
      strategy?.mode === "advanced" ? strategy : createAdvancedStrategy(),
    );
  }

  function handlePresetSelect(preset: OptimizationPreset) {
    setOptimizationStrategy(createPresetStrategy(preset));
  }

  function customizeSelectedPreset() {
    if (strategy?.mode !== "preset" || !strategy.preset) {
      setOptimizationStrategy(createPriorityStrategy());
      return;
    }

    const presetObjectives = presetDefinitions[strategy.preset].objectives;
    const remainingObjectives = priorityObjectiveOrder.filter(
      (type) => !presetObjectives.includes(type),
    );

    setOptimizationStrategy(
      createPriorityStrategy([...presetObjectives, ...remainingObjectives]),
    );
  }

  function handleStrategyChange(nextStrategy: OptimizationStrategy) {
    setOptimizationStrategy(nextStrategy);
  }

  return (
    <section className="mt-8">
      <div className="mb-5">
        <h2 className="font-display text-2xl font-medium text-foreground">
          Route strategy
        </h2>
        <p className="mt-1 text-base text-muted-foreground">
          Start simple, then tune only the tradeoffs that matter.
        </p>
      </div>

      <div className="mb-5 grid gap-3 rounded-lg border border-border bg-surface-low p-4 md:grid-cols-2">
        <StrategyBoundary
          label="Requirements"
          text="These must be respected."
          values={[
            "Vehicle capacities",
            "Strict delivery windows",
            "Required deliveries",
            "Pickup before delivery",
          ]}
        />
        <StrategyBoundary
          label="Preferences"
          text="RoutesPilot tries to optimize these."
          values={[
            "Travel time",
            "Distance",
            "Estimated cost",
            "Workload balance",
            "Flexible windows",
          ]}
        />
      </div>

      <div className="mb-5 grid gap-2 sm:grid-cols-3">
        {modeOptions.map((option) => {
          const selected = mode === option.value;
          const Icon = option.icon;
          const available = isFeatureAvailable(option.value);

          return (
            <button
              className={cn(
                "flex min-h-20 items-center gap-3 rounded-lg border bg-surface p-3 text-left transition-colors hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-50",
                selected
                  ? "border-2 border-primary-accent bg-primary-accent/5"
                  : "border-border",
              )}
              disabled={!available}
              key={option.value}
              onClick={() => handleModeChange(option.value)}
              type="button"
            >
              <Icon
                aria-hidden
                className="h-5 w-5 shrink-0 text-primary-accent"
              />
              <span className="min-w-0">
                <span className="block font-display text-sm font-semibold text-foreground">
                  {option.label}
                </span>
                <span className="block text-sm leading-5 text-muted-foreground">
                  {option.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {mode === "priority" && strategy ? (
        <PriorityEditor onChange={handleStrategyChange} strategy={strategy} />
      ) : mode === "advanced" && strategy ? (
        <WeightEditor onChange={handleStrategyChange} strategy={strategy} />
      ) : (
        <PresetSelector
          isFeatureAvailable={() => true}
          onSelect={handlePresetSelect}
          selectedPreset={
            strategy?.mode === "preset" ? strategy.preset : undefined
          }
        />
      )}

      {mode === "preset" && strategy?.mode === "preset" && strategy.preset ? (
        <div className="mt-4 rounded-lg border border-border bg-surface-low p-4">
          <p className="font-display text-sm font-semibold text-foreground">
            {presetDefinitions[strategy.preset].label}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Prioritizes{" "}
            {presetDefinitions[strategy.preset].objectives
              .map((type) => objectiveDefinitions[type].label.toLowerCase())
              .join(", ")}
            .
          </p>
          <button
            className="mt-3 inline-flex rounded-lg border border-border bg-card px-3 py-2 font-display text-xs font-semibold text-foreground transition-colors hover:bg-surface"
            onClick={customizeSelectedPreset}
            type="button"
          >
            Customize
          </button>
        </div>
      ) : null}

      {isUnsupportedPreset ? (
        <StrategyIssueMessage message="This strategy is not available yet." />
      ) : null}

      {blockingStrategyIssues.length > 0 ? (
        <div className="mt-4 grid gap-2">
          {blockingStrategyIssues.map((issue) => (
            <StrategyIssueMessage key={issue.code} message={issue.message} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function StrategyBoundary({
  label,
  text,
  values,
}: {
  label: string;
  text: string;
  values: string[];
}) {
  return (
    <div className="flex items-start gap-3">
      <ClipboardCheck
        aria-hidden
        className="h-4 w-4 shrink-0 text-primary-accent"
      />
      <div>
        <p className="font-display text-xs font-semibold uppercase text-muted-foreground">
          {label}
        </p>
        <p className="mt-0.5 text-sm text-foreground">{text}</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          {values.join(" | ")}
        </p>
      </div>
    </div>
  );
}

function StrategyIssueMessage({ message }: { message: string }) {
  return (
    <p className="mt-4 rounded-md border border-amber-300 bg-amber-100 px-3 py-2 text-sm leading-6 text-amber-800">
      {message}
    </p>
  );
}
