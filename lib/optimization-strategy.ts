import type {
  OptimizationObjective,
  OptimizationObjectiveType,
  OptimizationPreset,
  OptimizationStrategy,
  RoutingProblem,
} from "@/lib/types";

export type CurrentSolverObjective =
  | "minimize_time"
  | "minimize_distance"
  | "minimize_vehicles"
  | "balance_workload"
  | "minimize_operating_cost";

export type OptimizationStrategyIssue = {
  field: string;
  code: string;
  message: string;
};

export type ObjectiveDefinition = {
  type: OptimizationObjectiveType;
  label: string;
  shortLabel: string;
  description: string;
  supportedByCurrentSolver: boolean;
};

export type PresetDefinition = {
  id: OptimizationPreset;
  label: string;
  description: string;
  objectives: OptimizationObjectiveType[];
  supportedByCurrentSolver: boolean;
};

export const objectiveDefinitions: Record<
  OptimizationObjectiveType,
  ObjectiveDefinition
> = {
  minimize_time: {
    type: "minimize_time",
    label: "Travel time",
    shortLabel: "Time",
    description: "Reduce total driving time.",
    supportedByCurrentSolver: true,
  },
  minimize_distance: {
    type: "minimize_distance",
    label: "Distance",
    shortLabel: "Distance",
    description: "Reduce total kilometers.",
    supportedByCurrentSolver: true,
  },
  minimize_vehicles: {
    type: "minimize_vehicles",
    label: "Vehicles used",
    shortLabel: "Vehicles",
    description: "Use fewer vehicles when possible.",
    supportedByCurrentSolver: true,
  },
  balance_workload: {
    type: "balance_workload",
    label: "Workload balance",
    shortLabel: "Balance",
    description: "Keep vehicle workloads more even.",
    supportedByCurrentSolver: true,
  },
  minimize_operating_cost: {
    type: "minimize_operating_cost",
    label: "Operating cost",
    shortLabel: "Cost",
    description: "Prefer lower operating cost.",
    supportedByCurrentSolver: true,
  },
};

export const presetDefinitions: Record<OptimizationPreset, PresetDefinition> = {
  fastest: {
    id: "fastest",
    label: "Fastest",
    description: "Reduce total travel and completion time.",
    objectives: ["minimize_time", "minimize_distance"],
    supportedByCurrentSolver: true,
  },
  shortest: {
    id: "shortest",
    label: "Shortest",
    description: "Reduce total distance.",
    objectives: ["minimize_distance", "minimize_time"],
    supportedByCurrentSolver: true,
  },
  cost_efficient: {
    id: "cost_efficient",
    label: "Lowest cost",
    description: "Reduce estimated operating cost.",
    objectives: [
      "minimize_operating_cost",
      "minimize_distance",
      "minimize_time",
    ],
    supportedByCurrentSolver: true,
  },
  balanced: {
    id: "balanced",
    label: "Balanced",
    description: "Keep workloads more even across vehicles.",
    objectives: [
      "balance_workload",
      "minimize_time",
      "minimize_distance",
    ],
    supportedByCurrentSolver: true,
  },
};

export const presetOptions = Object.values(presetDefinitions);

export const priorityObjectiveOrder: OptimizationObjectiveType[] = [
  "minimize_vehicles",
  "minimize_time",
  "minimize_distance",
  "balance_workload",
  "minimize_operating_cost",
];

export const advancedObjectiveOrder: OptimizationObjectiveType[] = [
  "minimize_time",
  "minimize_operating_cost",
  "minimize_distance",
  "minimize_vehicles",
  "balance_workload",
];

const knownObjectiveTypes = new Set(Object.keys(objectiveDefinitions));

const legacyObjectivePresets: Record<OptimizationObjective, OptimizationPreset> = {
  minimize_time: "fastest",
  minimize_distance: "shortest",
  minimize_vehicles: "cost_efficient",
  balance_workload: "balanced",
  minimize_operating_cost: "cost_efficient",
};

const solverPresetObjectives: Partial<
  Record<OptimizationPreset, CurrentSolverObjective>
> = {
  fastest: "minimize_time",
  shortest: "minimize_distance",
  cost_efficient: "minimize_operating_cost",
  balanced: "balance_workload",
};

const currentSolverObjectives = new Set<OptimizationObjectiveType>([
  "minimize_time",
  "minimize_distance",
  "minimize_vehicles",
  "balance_workload",
  "minimize_operating_cost",
]);

export function createPresetStrategy(
  preset: OptimizationPreset,
): OptimizationStrategy {
  return {
    mode: "preset",
    preset,
    objectives: presetDefinitions[preset].objectives.map((type, index) => ({
      type,
      enabled: true,
      priority: index + 1,
    })),
  };
}

export function createPriorityStrategy(
  objectiveTypes: OptimizationObjectiveType[] = priorityObjectiveOrder,
): OptimizationStrategy {
  return normalizePriorityStrategy({
    mode: "priority",
    objectives: objectiveTypes.map((type, index) => ({
      type,
      enabled: true,
      priority: index + 1,
    })),
  });
}

export function createAdvancedStrategy(
  weights: Partial<Record<OptimizationObjectiveType, number>> = {
    minimize_time: 0.4,
    minimize_operating_cost: 0.3,
    minimize_distance: 0.15,
    minimize_vehicles: 0.1,
    balance_workload: 0.05,
  },
): OptimizationStrategy {
  return {
    mode: "advanced",
    objectives: advancedObjectiveOrder.map((type, index) => ({
      type,
      enabled: true,
      priority: index + 1,
      weight: clampWeight(weights[type] ?? 0),
    })),
  };
}

export function strategyFromLegacyObjective(
  objective?: OptimizationObjective,
): OptimizationStrategy | undefined {
  return objective ? createPresetStrategy(legacyObjectivePresets[objective]) : undefined;
}

export function getEffectiveOptimizationStrategy(
  problem: Pick<RoutingProblem, "optimizationStrategy" | "objective">,
) {
  return problem.optimizationStrategy ?? strategyFromLegacyObjective(problem.objective);
}

export function normalizePriorityStrategy(
  strategy: OptimizationStrategy,
): OptimizationStrategy {
  const normalizedPriorityByType = new Map<OptimizationObjectiveType, number>();

  strategy.objectives
    .filter((objective) => objective.enabled)
    .sort((left, right) =>
      left.priority === right.priority
        ? left.type.localeCompare(right.type)
        : left.priority - right.priority,
    )
    .forEach((objective, index) => {
      normalizedPriorityByType.set(objective.type, index + 1);
    });

  return {
    ...strategy,
    objectives: strategy.objectives.map((objective) =>
      objective.enabled
        ? {
            ...objective,
            priority: normalizedPriorityByType.get(objective.type) ?? objective.priority,
          }
        : objective,
    ),
  };
}

export function normalizeAdvancedWeights(
  strategy: OptimizationStrategy,
): OptimizationStrategy {
  const enabledObjectives = strategy.objectives.filter(
    (objective) => objective.enabled,
  );
  const total = enabledObjectives.reduce(
    (sum, objective) => sum + (objective.weight ?? 0),
    0,
  );

  if (total <= 0) {
    return strategy;
  }

  return {
    ...strategy,
    objectives: strategy.objectives.map((objective) =>
      objective.enabled
        ? {
            ...objective,
            weight: roundWeight((objective.weight ?? 0) / total),
          }
        : objective,
    ),
  };
}

export function validateOptimizationStrategy(
  strategy?: OptimizationStrategy,
): OptimizationStrategyIssue[] {
  if (!strategy) {
    return [
      {
        field: "optimizationStrategy",
        code: "MISSING_OPTIMIZATION_STRATEGY",
        message: "Optimization strategy is required.",
      },
    ];
  }

  const issues: OptimizationStrategyIssue[] = [];

  if (!["preset", "priority", "advanced"].includes(strategy.mode)) {
    issues.push({
      field: "optimizationStrategy.mode",
      code: "INVALID_OPTIMIZATION_STRATEGY_MODE",
      message: "Optimization strategy mode is invalid.",
    });
  }

  if (strategy.mode === "preset") {
    if (!strategy.preset || !(strategy.preset in presetDefinitions)) {
      issues.push({
        field: "optimizationStrategy.preset",
        code: "INVALID_OPTIMIZATION_PRESET",
        message: "Optimization preset is invalid.",
      });
    }
  } else if (strategy.preset) {
    issues.push({
      field: "optimizationStrategy.preset",
      code: "INVALID_OPTIMIZATION_PRESET",
      message: "Only preset mode may include a preset.",
    });
  }

  const objectives = Array.isArray(strategy.objectives)
    ? strategy.objectives
    : [];

  if (!Array.isArray(strategy.objectives)) {
    issues.push({
      field: "optimizationStrategy.objectives",
      code: "INVALID_OBJECTIVES",
      message: "Optimization objectives are invalid.",
    });
  }

  const objectiveTypes = objectives.map((objective) => objective.type);

  if (objectiveTypes.some((type) => !knownObjectiveTypes.has(type))) {
    issues.push({
      field: "optimizationStrategy.objectives",
      code: "INVALID_OBJECTIVE_TYPE",
      message: "Optimization objective type is invalid.",
    });
  }

  const duplicateTypes = valuesWithDuplicates(objectiveTypes);

  if (duplicateTypes.length > 0) {
    issues.push({
      field: "optimizationStrategy.objectives",
      code: "DUPLICATE_OBJECTIVE_TYPE",
      message: "Objective types must be unique.",
    });
  }

  const enabledObjectives = objectives.filter(
    (objective) => objective.enabled,
  );

  if (enabledObjectives.length === 0) {
    issues.push({
      field: "optimizationStrategy.objectives",
      code: "NO_ENABLED_OBJECTIVES",
      message: "At least one objective must be enabled.",
    });
  }

  const duplicatePriorities = valuesWithDuplicates(
    enabledObjectives.map((objective) => objective.priority),
  );

  if (duplicatePriorities.length > 0) {
    issues.push({
      field: "optimizationStrategy.objectives",
      code: "DUPLICATE_OBJECTIVE_PRIORITY",
      message: "Objective priorities must be unique.",
    });
  }

  if (enabledObjectives.some((objective) => objective.priority < 1)) {
    issues.push({
      field: "optimizationStrategy.objectives",
      code: "INVALID_OBJECTIVE_PRIORITY",
      message: "Objective priorities must be positive.",
    });
  }

  if (strategy.mode === "advanced") {
    const total = getAdvancedWeightTotal(strategy);
    const hasInvalidWeight = enabledObjectives.some(
      (objective) =>
        typeof objective.weight !== "number" ||
        !Number.isFinite(objective.weight) ||
        objective.weight <= 0 ||
        objective.weight > 1,
    );

    if (hasInvalidWeight) {
      issues.push({
        field: "optimizationStrategy.objectives",
        code: "INVALID_OBJECTIVE_WEIGHT",
        message: "Enabled advanced objectives require positive weights.",
      });
    }

    if (Math.abs(total - 1) > 0.001) {
      issues.push({
        field: "optimizationStrategy.objectives",
        code: "INVALID_OBJECTIVE_WEIGHT_TOTAL",
        message: "Advanced objective weights must total 100%.",
      });
    }
  }

  if (issues.length === 0 && hasUnsupportedEnabledObjective(strategy)) {
    issues.push({
      field: "optimizationStrategy",
      code: "UNSUPPORTED_OPTIMIZATION_STRATEGY",
      message:
        "This strategy includes an objective that is not supported by the current optimizer.",
    });
  }

  return issues;
}

export function getCurrentSolverObjective(
  strategy: OptimizationStrategy,
): CurrentSolverObjective | null {
  if (strategy.mode === "preset" && strategy.preset) {
    return solverPresetObjectives[strategy.preset] ?? null;
  }

  const enabledObjectives = [...strategy.objectives]
    .filter((objective) => objective.enabled)
    .sort((left, right) =>
      left.priority === right.priority
        ? left.type.localeCompare(right.type)
        : left.priority - right.priority,
    );

  if (
    enabledObjectives.some(
      (objective) => !currentSolverObjectives.has(objective.type),
    )
  ) {
    return null;
  }

  const firstEnabledObjective = enabledObjectives[0];

  return firstEnabledObjective
    ? (firstEnabledObjective.type as CurrentSolverObjective)
    : null;
}

export function getAdvancedWeightTotal(strategy: OptimizationStrategy) {
  return roundWeight(
    strategy.objectives
      .filter((objective) => objective.enabled)
      .reduce((sum, objective) => sum + (objective.weight ?? 0), 0),
  );
}

export function describeOptimizationStrategy(strategy?: OptimizationStrategy) {
  if (!strategy) {
    return {
      label: "Not selected",
      detail: "Choose what matters most.",
      lines: [],
    };
  }

  if (strategy.mode === "preset" && strategy.preset) {
    const preset = presetDefinitions[strategy.preset];

    return {
      label: preset.label,
      detail: preset.description,
      lines: preset.objectives.map((type, index) => (
        `${index + 1}. ${objectiveDefinitions[type].label}`
      )),
    };
  }

  const orderedObjectives = [...strategy.objectives]
    .filter((objective) => objective.enabled)
    .sort((left, right) => left.priority - right.priority);

  if (strategy.mode === "advanced") {
    return {
      label: "Custom weights",
      detail: `${Math.round(getAdvancedWeightTotal(strategy) * 100)}% total`,
      lines: orderedObjectives.map(
        (objective) =>
          `${objectiveDefinitions[objective.type].label} ${Math.round(
            (objective.weight ?? 0) * 100,
          )}%`,
      ),
    };
  }

  return {
    label: "Set priorities",
    detail: `${orderedObjectives.length} preferences`,
    lines: orderedObjectives.map(
      (objective) =>
        `${objective.priority}. ${objectiveDefinitions[objective.type].label}`,
    ),
  };
}

export function objectiveLabel(type: OptimizationObjectiveType) {
  return objectiveDefinitions[type].label;
}

function valuesWithDuplicates<T>(values: T[]) {
  const seen = new Set<T>();
  const duplicates = new Set<T>();

  values.forEach((value) => {
    if (seen.has(value)) {
      duplicates.add(value);
    }

    seen.add(value);
  });

  return [...duplicates];
}

function clampWeight(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(1, Math.max(0, roundWeight(value)));
}

function roundWeight(value: number) {
  return Number(value.toFixed(6));
}

function hasUnsupportedEnabledObjective(strategy: OptimizationStrategy) {
  if (strategy.mode === "preset") {
    return Boolean(
      strategy.preset && !presetDefinitions[strategy.preset]?.supportedByCurrentSolver,
    );
  }

  return strategy.objectives.some(
    (objective) =>
      objective.enabled && !currentSolverObjectives.has(objective.type),
  );
}
