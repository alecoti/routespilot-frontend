import type {
  ConversationAction,
  ConversationAnswer,
  ConversationQuestion,
  VehicleCapacityAnswer,
} from "@/lib/conversation-types";
import { assessConversationReadiness } from "@/lib/conversation-readiness";
import {
  defaultCapacityDimension,
  ensureCapacityDimensions,
  formatCapacityValue,
  summarizeCapacityUsage,
  withVehicleCapacity,
} from "@/lib/capacity";
import {
  createPresetStrategy,
  presetOptions,
} from "@/lib/optimization-strategy";
import {
  getVehicleCapacityRequirements,
  validateRoutingProblem,
} from "@/lib/routing-validation";
import type {
  CapacityDimensionDefinition,
  DeliveryStop,
  OptimizationPreset,
  RoutingProblem,
  Vehicle,
} from "@/lib/types";
import { createLocation } from "@/lib/locations";

const strategyOptions = presetOptions.map((preset) => ({
  label: preset.label,
  value: preset.id,
}));
const supportedStrategyOptions = presetOptions
  .filter((preset) => preset.supportedByCurrentSolver)
  .map((preset) => ({
    label: preset.label,
    value: preset.id,
  }));

const defaultVehicleCapacities = [800, 1200, 1000];

export function getNextQuestion(
  problem: RoutingProblem,
): ConversationQuestion | null {
  const readiness = assessConversationReadiness(problem);
  const validation = validateRoutingProblem(problem);

  if (
    readiness.missingRequirements.length === 0 &&
    readiness.unresolvedLocations.length > 0
  ) {
    return null;
  }

  if (
    readiness.missingRequirements.length === 0 &&
    readiness.conflicts.length === 0
  ) {
    return null;
  }

  if (hasMissingRequirement(readiness, "MISSING_DEPOT")) {
    return {
      id: "depot",
      type: "address",
      message: "Where should the vehicles start from?",
    };
  }

  if (hasMissingRequirement(readiness, "NO_STOPS")) {
    return {
      id: "stops",
      type: "text",
      message: "Which deliveries should be included in this route plan?",
    };
  }

  if (hasMissingRequirement(readiness, "NO_VEHICLES")) {
    return {
      id: "vehicles",
      type: "number",
      message: "How many vehicles are available for this optimization?",
    };
  }

  if (hasMissingRequirement(readiness, "MISSING_RETURN_TO_DEPOT")) {
    return {
      id: "return-to-depot",
      type: "boolean",
      message: "Should each vehicle return to the depot after its last stop?",
      options: [
        { label: "Return to depot", value: "true" },
        { label: "Finish at last stop", value: "false" },
      ],
    };
  }

  if (hasMissingRequirement(readiness, "MISSING_VEHICLE_CAPACITY")) {
    const requirements = getVehicleCapacityRequirements(problem).filter(
      (requirement) =>
        readiness.missingRequirements.some(
          (missing) =>
            missing.code === "MISSING_VEHICLE_CAPACITY" &&
            missing.dimensionKey === requirement.dimension.key,
        ),
    );
    const capacityDimensions =
      requirements.length > 0
        ? requirements.map((requirement) => requirement.dimension)
        : [defaultCapacityDimension];
    const missingVehicleCapacityIds = [
      ...new Set(
        readiness.missingRequirements
          .filter((requirement) => requirement.code === "MISSING_VEHICLE_CAPACITY")
          .flatMap((requirement) => requirement.vehicleIds ?? []),
      ),
    ];

    return {
      id: "vehicle-capacities",
      type: "vehicle_capacities",
      message: formatVehicleCapacityQuestionMessage(readiness.missingRequirements),
      capacityDimensions,
      missingVehicleCapacityIds:
        missingVehicleCapacityIds.length > 0
          ? missingVehicleCapacityIds
          : problem.vehicles.map((vehicle) => vehicle.id),
    };
  }

  if (hasConflict(readiness, "TOTAL_DEMAND_EXCEEDS_CAPACITY")) {
    return null;
  }

  if (
    hasMissingRequirement(readiness, "MISSING_OPTIMIZATION_STRATEGY") ||
    hasConflict(readiness, "UNSUPPORTED_OPTIMIZATION_STRATEGY")
  ) {
    const unsupportedStrategy = hasConflict(readiness, "UNSUPPORTED_OPTIMIZATION_STRATEGY");

    return {
      id: "optimization-strategy",
      type: "single_select",
      message: unsupportedStrategy
        ? "Choose a strategy supported by the current optimizer."
        : "What should RoutesPilot optimize for first?",
      options: unsupportedStrategy ? supportedStrategyOptions : strategyOptions,
    };
  }

  if (validation.invalidFields.some((field) => field.includes("timeWindow"))) {
    return {
      id: "time-windows",
      type: "text",
      message:
        "Some time windows need correction. Use HH:mm format, with the end time after the start time.",
    };
  }

  return {
    id: "problem-details",
    type: "text",
    message:
      readiness.missingRequirements[0]?.message ??
      "Please add the missing route details so I can continue.",
  };
}

export function deriveConversationAction(
  problem: RoutingProblem,
): ConversationAction {
  const readiness = assessConversationReadiness(problem);
  const nextQuestion = getNextQuestion(problem);

  if (nextQuestion) {
    return {
      type: "ASK_MISSING_INFORMATION",
      message: nextQuestion.message,
      question: nextQuestion,
      readiness,
    };
  }

  if (readiness.unresolvedLocations.length > 0) {
    return {
      type: "REVIEW_LOCATIONS",
      message: "Review unresolved locations before optimizing.",
      question: null,
      readiness,
    };
  }

  if (readiness.blockers.length > 0) {
    return {
      type: "SHOW_CONFLICT",
      message: readiness.blockers[0].message,
      question: null,
      readiness,
    };
  }

  if (readiness.readyForOptimization) {
    return {
      type: "PROCEED_TO_REVIEW",
      message: "Everything is ready.",
      question: null,
      readiness,
    };
  }

  return {
    type: "INFORMATIONAL_RESPONSE",
    message: "Please add the missing route details so I can continue.",
    question: null,
    readiness,
  };
}

export function composeImportReadinessMessage(
  problem: RoutingProblem,
  options: { fileName?: string; importedStopCount?: number } = {},
): string {
  const readiness = assessConversationReadiness(problem);
  const importedStopCount = options.importedStopCount ?? problem.stops.length;
  const fileReference = options.fileName ? ` da ${options.fileName}` : "";
  const intro = `Ho caricato ${importedStopCount} consegne${fileReference}.`;

  if (readiness.readyForOptimization) {
    return `${intro} Il piano ha i dati necessari: posso procedere con la revisione e poi con l'ottimizzazione.`;
  }

  const missingParts = summarizeReadinessGaps(problem);

  if (missingParts.length === 0) {
    return `${intro} Prima di ottimizzare devo ancora controllare alcuni dettagli del piano.`;
  }

  return `${intro} Non posso ancora procedere con l'ottimizzazione: ${joinItalianList(
    missingParts,
  )}. Scrivimi questi dati in chat e aggiorno il piano.`;
}

export function composeImportReadinessNote(problem: RoutingProblem): string | null {
  const gaps = summarizeReadinessGaps(problem);

  if (gaps.length === 0) {
    return null;
  }

  return `Mancano ancora: ${joinItalianList(gaps)}.`;
}

export function applyConversationAnswer(
  problem: RoutingProblem,
  question: ConversationQuestion,
  answer: ConversationAnswer,
): RoutingProblem {
  let nextProblem = problem;

  if (question.id === "depot" && typeof answer === "string") {
    nextProblem = {
      ...problem,
      depot: createLocation(answer.trim()),
    };
  }

  if (question.id === "stops" && typeof answer === "string") {
    const stop = createStopFromText(answer, problem.stops.length + 1);
    nextProblem = {
      ...problem,
      stops: [...problem.stops, stop],
    };
  }

  if (question.id === "vehicles" && typeof answer === "number") {
    nextProblem = {
      ...problem,
      vehicles: createVehicles(answer),
    };
  }

  if (question.id === "return-to-depot" && typeof answer === "boolean") {
    nextProblem = {
      ...problem,
      returnToDepot: answer,
    };
  }

  if (question.id === "optimization-strategy" && typeof answer === "string") {
    nextProblem = {
      ...problem,
      optimizationStrategy: createPresetStrategy(answer as OptimizationPreset),
      objective: undefined,
    };
  }

  if (
    question.id === "vehicle-capacities" &&
    Array.isArray(answer) &&
    isVehicleCapacityAnswer(answer)
  ) {
    const capacityDimensions = capacityDimensionsForQuestion(question);
    const capacitiesByVehicleAndDimension = new Map(
      answer.map((item) => [
        capacityKey(item.vehicleId, item.dimensionKey ?? capacityDimensions[0].key),
        item.capacity,
      ]),
    );

    nextProblem = {
      ...problem,
      capacityDimensions: ensureCapacityDimensions(
        problem.capacityDimensions,
        capacityDimensions,
      ),
      vehicles: problem.vehicles.map((vehicle) => ({
        ...capacityDimensions.reduce(
          (nextVehicle, dimension) => {
            const providedCapacity = capacitiesByVehicleAndDimension.get(
              capacityKey(vehicle.id, dimension.key),
            );

            if (typeof providedCapacity !== "number") {
              return nextVehicle;
            }

            return withVehicleCapacity(
              nextVehicle,
              dimension.key,
              providedCapacity,
            );
          },
          vehicle,
        ),
      })),
    };
  }

  if (question.id === "time-windows" && typeof answer === "string") {
    const correctedTimeWindow = parseTimeWindowAnswer(answer) ?? {
      start: "09:00",
      end: "17:00",
      mode: "hard" as const,
    };
    const invalidStopIndexes = getInvalidTimeWindowStopIndexes(problem);

    nextProblem = {
      ...problem,
      stops: problem.stops.map((stop, index) =>
        invalidStopIndexes.has(index)
          ? { ...stop, timeWindow: correctedTimeWindow }
          : stop,
      ),
    };
  }

  return withDerivedStatus(nextProblem);
}

export function formatConversationAnswer(
  question: ConversationQuestion,
  answer: ConversationAnswer,
) {
  if (question.id === "return-to-depot" && typeof answer === "boolean") {
    return answer ? "Return to depot" : "Finish at last stop";
  }

  if (question.id === "optimization-strategy" && typeof answer === "string") {
    return strategyOptions.find((option) => option.value === answer)?.label ?? answer;
  }

  if (question.id === "vehicles" && typeof answer === "number") {
    return `${answer} ${answer === 1 ? "vehicle" : "vehicles"}`;
  }

  if (question.id === "vehicle-capacities" && Array.isArray(answer)) {
    return answer
      .map((item) => {
        const dimension = capacityDimensionsForQuestion(question).find(
          (candidate) => candidate.key === item.dimensionKey,
        );

        return `${item.vehicleName ?? getVehicleLabel(item.vehicleId)}: ${
          dimension
            ? formatCapacityValue(item.capacity, dimension)
            : `${item.capacity} kg`
        }`;
      })
      .join("\n");
  }

  return String(answer);
}

function hasMissingRequirement(
  readiness: ReturnType<typeof assessConversationReadiness>,
  code: string,
) {
  return readiness.missingRequirements.some(
    (requirement) => requirement.code === code,
  );
}

function hasConflict(
  readiness: ReturnType<typeof assessConversationReadiness>,
  code: string,
) {
  return readiness.conflicts.some((conflict) => conflict.code === code);
}

function formatVehicleCapacityQuestionMessage(
  missingRequirements: ReturnType<
    typeof assessConversationReadiness
  >["missingRequirements"],
) {
  const capacityRequirements = missingRequirements.filter(
    (requirement) => requirement.code === "MISSING_VEHICLE_CAPACITY",
  );

  if (capacityRequirements.length === 1) {
    const requirement = capacityRequirements[0];

    return `What ${requirement.dimensionLabel?.toLowerCase() ?? "capacity"} should RoutesPilot use for ${requirement.entityName ?? "this vehicle"}?`;
  }

  const dimensions = [
    ...new Set(
      capacityRequirements
        .map((requirement) => requirement.dimensionLabel)
        .filter((label): label is string => Boolean(label)),
    ),
  ];

  if (dimensions.length === 1) {
    return `What ${dimensions[0].toLowerCase()} capacity should RoutesPilot use for each missing vehicle?`;
  }

  return "What capacities should RoutesPilot use for the missing vehicle fields?";
}

function summarizeReadinessGaps(problem: RoutingProblem): string[] {
  const readiness = assessConversationReadiness(problem);
  const gaps: string[] = [];

  readiness.missingRequirements.forEach((requirement) => {
    if (requirement.code === "MISSING_DEPOT") {
      gaps.push("il deposito di partenza");
      return;
    }

    if (requirement.code === "NO_VEHICLES") {
      gaps.push("almeno un veicolo con le sue capacita");
      return;
    }

    if (requirement.code === "NO_STOPS") {
      gaps.push("le consegne da pianificare");
      return;
    }

    if (requirement.code === "MISSING_RETURN_TO_DEPOT") {
      gaps.push("se i veicoli devono rientrare al deposito");
      return;
    }

    if (requirement.code === "MISSING_VEHICLE_CAPACITY") {
      const vehicleName = requirement.entityName ?? "un veicolo";
      const dimension = requirement.dimensionLabel?.toLowerCase() ?? "capacita";

      gaps.push(`${vehicleName}: capacita ${dimension}`);
      return;
    }

    gaps.push(requirement.message);
  });

  readiness.conflicts.forEach((conflict) => {
    if (conflict.code === "TOTAL_DEMAND_EXCEEDS_CAPACITY") {
      const capacityConflict = summarizeCapacityUsage(problem).find(
        (item) => item.requiredDemand > item.totalCapacity,
      );

      if (capacityConflict) {
        const deficit =
          capacityConflict.requiredDemand - capacityConflict.totalCapacity;

        gaps.push(
          `${capacityConflict.dimension.label.toLowerCase()} insufficiente: servono ${formatCapacityValue(
            capacityConflict.requiredDemand,
            capacityConflict.dimension,
          )}, disponibili ${formatCapacityValue(
            capacityConflict.totalCapacity,
            capacityConflict.dimension,
          )}, mancano ${formatCapacityValue(
            deficit,
            capacityConflict.dimension,
          )}`,
        );
        return;
      }
    }

    gaps.push(conflict.message);
  });

  return [...new Set(gaps)].slice(0, 4);
}

function joinItalianList(items: string[]): string {
  if (items.length <= 1) {
    return items[0] ?? "";
  }

  if (items.length === 2) {
    return `${items[0]} e ${items[1]}`;
  }

  return `${items.slice(0, -1).join(", ")} e ${items.at(-1)}`;
}

function createVehicles(count: number): Vehicle[] {
  const safeCount = Math.max(1, Math.min(20, Math.floor(count)));

  return Array.from({ length: safeCount }, (_, index) => ({
    id: `vehicle-${index + 1}`,
    name: `Van ${index + 1}`,
    capacity: defaultVehicleCapacities[index] ?? 800,
    capacities: {
      load: defaultVehicleCapacities[index] ?? 800,
    },
  }));
}

function createStopFromText(text: string, index: number): DeliveryStop {
  const name = text.trim() || `Stop ${index}`;

  return {
    id: `stop-${index}`,
    name,
    address: name,
    priority: "normal",
    servicePolicy: "required",
  };
}

function withDerivedStatus(problem: RoutingProblem): RoutingProblem {
  if (problem.status === "completed" || problem.status === "failed") {
    return problem;
  }

  return {
    ...problem,
    status: assessConversationReadiness(problem).readyForReview
      ? "ready"
      : "collecting",
  };
}

function isVehicleCapacityAnswer(
  answer: unknown[],
): answer is VehicleCapacityAnswer[] {
  return answer.every(
    (item) =>
      typeof item === "object" &&
      item !== null &&
      "vehicleId" in item &&
      "capacity" in item,
  );
}

function capacityDimensionsForQuestion(
  question: ConversationQuestion,
): CapacityDimensionDefinition[] {
  return question.capacityDimensions?.length
    ? question.capacityDimensions.map((dimension) => ({
        key: dimension.key,
        label: dimension.label,
        unit: dimension.unit,
        valueType: dimension.key === "pallets" || dimension.key === "packages"
          ? "integer"
          : "decimal",
      }))
    : [defaultCapacityDimension];
}

function capacityKey(vehicleId: string, dimensionKey: string) {
  return `${vehicleId}:${dimensionKey}`;
}

function getVehicleLabel(vehicleId: string) {
  return vehicleId.replace("vehicle-", "Van ");
}

function getInvalidTimeWindowStopIndexes(problem: RoutingProblem) {
  return new Set(
    validateRoutingProblem(problem).issues
      .filter((issue) => issue.field.includes("timeWindow"))
      .map((issue) => /^stops\.(\d+)/.exec(issue.field)?.[1])
      .filter((index): index is string => typeof index === "string")
      .map(Number),
  );
}

function parseTimeWindowAnswer(answer: string) {
  const match = /([01]\d|2[0-3]):([0-5]\d)\D+([01]\d|2[0-3]):([0-5]\d)/.exec(
    answer,
  );

  if (!match) {
    return null;
  }

  return {
    start: `${match[1]}:${match[2]}`,
    end: `${match[3]}:${match[4]}`,
    mode: "hard" as const,
  };
}
