"use client";

import {
  createPriorityStrategy,
  objectiveDefinitions,
  priorityObjectiveOrder,
} from "@/lib/optimization-strategy";
import type { OptimizationObjectiveType, OptimizationStrategy } from "@/lib/types";
import { ObjectiveRow } from "@/components/optimization-strategy/objective-row";

export function PriorityEditor({
  onChange,
  strategy,
}: {
  onChange: (strategy: OptimizationStrategy) => void;
  strategy: OptimizationStrategy;
}) {
  const orderedObjectives = getOrderedObjectives(strategy);

  function moveObjective(type: OptimizationObjectiveType, direction: -1 | 1) {
    const currentIndex = orderedObjectives.indexOf(type);
    const nextIndex = currentIndex + direction;

    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= orderedObjectives.length) {
      return;
    }

    const nextOrder = [...orderedObjectives];
    const [movedObjective] = nextOrder.splice(currentIndex, 1);

    nextOrder.splice(nextIndex, 0, movedObjective);
    onChange(createPriorityStrategy(nextOrder));
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="font-display text-sm font-semibold text-foreground">
          Set priorities
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose what matters most, in order.
        </p>
      </div>
      {orderedObjectives.map((type, index) => {
        const definition = objectiveDefinitions[type];

        return (
          <ObjectiveRow
            description={definition.description}
            isFirst={index === 0}
            isLast={index === orderedObjectives.length - 1}
            key={type}
            label={definition.label}
            onMoveDown={() => moveObjective(type, 1)}
            onMoveUp={() => moveObjective(type, -1)}
            prefix={String(index + 1)}
          />
        );
      })}
    </div>
  );
}

function getOrderedObjectives(strategy: OptimizationStrategy) {
  const configuredTypes = strategy.objectives
    .filter((objective) => objective.enabled)
    .sort((left, right) => left.priority - right.priority)
    .map((objective) => objective.type);

  if (configuredTypes.length > 0) {
    return configuredTypes;
  }

  return priorityObjectiveOrder;
}
