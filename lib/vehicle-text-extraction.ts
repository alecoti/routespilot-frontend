import type {
  CapacityDimensionDefinition,
  OptimizationObjectiveType,
  OptimizationStrategy,
} from "@/lib/types";
import type {
  RoutingExtraction,
  RoutingProblemPatch,
  VehicleExtraction,
} from "@/lib/api/chat-types";
import { operationsFromProblemPatch } from "@/lib/conversation-patch-operations";

const capacityDefinitions: Record<string, CapacityDimensionDefinition> = {
  weight: { key: "weight", label: "Weight", unit: "kg", valueType: "decimal" },
  volume: { key: "volume", label: "Volume", unit: "m3", valueType: "decimal" },
  pallets: {
    key: "pallets",
    label: "Pallets",
    unit: "pallets",
    valueType: "integer",
  },
  packages: {
    key: "packages",
    label: "Packages",
    unit: "pcs",
    valueType: "integer",
  },
};

const moneyPattern = "(?:\\u20ac|EUR|euro)";
const sectionBoundary =
  "Per tutti i veicoli|Entrambi i veicoli|Tutte le consegne|Usa questa strategia|Come strategia|Considera|Ottimizza";

export function mergeDeterministicRoutingFacts(
  extraction: RoutingExtraction,
  message: string,
): RoutingExtraction {
  const deterministicPatch = extractDeterministicRoutingPatch(message);

  if (!hasPatchContent(deterministicPatch)) {
    return extraction;
  }

  const problemPatch = mergeProblemPatches(
    extraction.problemPatch,
    deterministicPatch,
  );
  const baseOperations =
    extraction.operations && extraction.operations.length > 0
      ? extraction.operations
      : operationsFromProblemPatch(extraction.problemPatch);
  const deterministicOperations = operationsFromProblemPatch(problemPatch);

  return {
    ...extraction,
    patchSchemaVersion: "operations_v1",
    problemPatch,
    operations: mergeConversationOperations(
      baseOperations,
      deterministicOperations,
    ),
  };
}

export function extractDeterministicRoutingPatch(
  message: string,
): RoutingProblemPatch {
  const normalizedMessage = normalizeMessageForParsing(message);
  const depot = extractDepot(normalizedMessage);
  const vehicles = extractVehicleBlocks(normalizedMessage);
  const vehicleCount = vehicles.length > 0 ? vehicles.length : undefined;
  const capacityDimensions = dimensionsForVehicles(vehicles);
  const sharedOvertime = extractSharedOvertime(normalizedMessage);
  const returnToDepot =
    /tornare\s+al\s+deposito|return\s+to\s+(the\s+)?depot/i.test(
      normalizedMessage,
    )
      ? true
      : undefined;
  const currency = new RegExp(moneyPattern, "i").test(normalizedMessage)
    ? "EUR"
    : undefined;
  const optimizationStrategy =
    extractWeightedStrategy(normalizedMessage) ??
    extractPriorityStrategy(normalizedMessage);

  return {
    ...(depot ? { depot } : {}),
    ...(currency ? { currency } : {}),
    ...(vehicleCount ? { vehicleCount } : {}),
    ...(capacityDimensions.length > 0 ? { capacityDimensions } : {}),
    ...(vehicles.length > 0
      ? {
          vehicles: vehicles.map((vehicle) => ({
            ...vehicle,
            operatingCost: {
              ...vehicle.operatingCost,
              ...sharedOvertime,
            },
          })),
        }
      : {}),
    ...(typeof returnToDepot === "boolean" ? { returnToDepot } : {}),
    ...(optimizationStrategy ? { optimizationStrategy } : {}),
  };
}

function extractDepot(message: string) {
  const match = /(?:deposito|depot)\s*(?:\u00e8|e'|:|is)?\s*:?\s*([\s\S]+)/i.exec(
    message,
  );

  if (!match) {
    return undefined;
  }

  const [depot] = match[1].split(
    /\b(?:ho\s+\d+\s+veicoli|veicolo\s+\d+|van\s+[\w\s-]+:|truck\s+[\w\s-]+:|per tutti i veicoli|entrambi i veicoli|usa questa strategia|come strategia|ottimizza)\b/i,
  );

  return depot.replace(/\s+/g, " ").trim() || undefined;
}

function extractVehicleBlocks(message: string): VehicleExtraction[] {
  return dedupeVehicles([
    ...extractNumberedVehicleBlocks(message),
    ...extractNamedVehicleBlocks(message),
  ]);
}

function extractNumberedVehicleBlocks(message: string): VehicleExtraction[] {
  const blocks: VehicleExtraction[] = [];
  const vehiclePattern = new RegExp(
    `VEICOLO\\s+\\d+\\s*[\\u2014\\u2013-]\\s*([^\\n]+)\\n?([\\s\\S]*?)(?=\\n?\\s*VEICOLO\\s+\\d+\\s*[\\u2014\\u2013-]|\\n?\\s*(?:${sectionBoundary})\\b|$)`,
    "gi",
  );

  for (const match of message.matchAll(vehiclePattern)) {
    const rawName = match[1].trim();
    const name = cleanVehicleName(rawName);
    const body = `${rawName}\n${match[2] ?? ""}`;

    if (!name || !hasVehicleFacts(body)) {
      continue;
    }

    blocks.push(buildVehicleExtraction(name, body));
  }

  return blocks;
}

function extractNamedVehicleBlocks(message: string): VehicleExtraction[] {
  const blocks: VehicleExtraction[] = [];
  const lines = message.split("\n");

  for (let index = 0; index < lines.length; index += 1) {
    const heading = /^\s*((?:Van|Truck|Furgone|Camion|Vehicle)[^:\n]{0,60})\s*:\s*$/i.exec(
      lines[index],
    );

    if (!heading) {
      continue;
    }

    const name = cleanVehicleName(heading[1]);
    const bodyLines: string[] = [];

    for (let bodyIndex = index + 1; bodyIndex < lines.length; bodyIndex += 1) {
      const line = lines[bodyIndex];

      if (
        /^\s*(?:Van|Truck|Furgone|Camion|Vehicle)[^:\n]{0,60}\s*:\s*$/i.test(
          line,
        ) ||
        new RegExp(`^\\s*(?:${sectionBoundary})\\b`, "i").test(line)
      ) {
        break;
      }

      bodyLines.push(line);
      index = bodyIndex;
    }

    const body = bodyLines.join("\n");

    if (!name || !hasVehicleFacts(body)) {
      continue;
    }

    blocks.push(buildVehicleExtraction(name, body));
  }

  return blocks;
}

function buildVehicleExtraction(name: string, body: string): VehicleExtraction {
  const capacities = extractCapacities(body);
  const operatingCost = extractOperatingCosts(body);

  return {
    name,
    ...(Object.keys(capacities).length > 0 ? { capacities } : {}),
    ...(operatingCost ? { operatingCost } : {}),
  };
}

function extractCapacities(body: string): NonNullable<VehicleExtraction["capacities"]> {
  const capacities: NonNullable<VehicleExtraction["capacities"]> = {};

  const weight = firstNumber(body, /(\d+(?:[,.]\d+)?)\s*kg\b/i);
  const volume = firstNumber(
    body,
    /(\d+(?:[,.]\d+)?)\s*(?:m\u00b3|m3\b|m\^3\b)/i,
  );
  const pallets = firstNumber(
    body,
    /(\d+(?:[,.]\d+)?)\s*(?:pallet|pallets|bancali)\b/i,
  );
  const packages = firstNumber(
    body,
    /(\d+(?:[,.]\d+)?)\s*(?:colli|packages|package|boxes|box|parcels|parcel)\b/i,
  );

  if (typeof weight === "number") {
    capacities.weight = weight;
  }

  if (typeof volume === "number") {
    capacities.volume = volume;
  }

  if (typeof pallets === "number") {
    capacities.pallets = pallets;
  }

  if (typeof packages === "number") {
    capacities.packages = packages;
  }

  return capacities;
}

function extractOperatingCosts(
  body: string,
): VehicleExtraction["operatingCost"] | undefined {
  const fixedCost = firstNumber(
    body,
    new RegExp(
      `${moneyPattern}\\s*(\\d+(?:[,.]\\d+)?)\\s*(?:costo\\s+fisso|fixed)|(?:costo\\s+fisso|fixed)[\\s\\S]{0,24}?${moneyPattern}\\s*(\\d+(?:[,.]\\d+)?)`,
      "i",
    ),
  );
  const costPerKm = firstNumber(
    body,
    new RegExp(`${moneyPattern}\\s*(\\d+(?:[,.]\\d+)?)\\s*\\/\\s*km\\b`, "i"),
  );
  const costPerHour = firstNumber(
    body,
    new RegExp(
      `${moneyPattern}\\s*(\\d+(?:[,.]\\d+)?)\\s*\\/\\s*(?:ora|hour|h)\\b`,
      "i",
    ),
  );
  const operatingCost: NonNullable<VehicleExtraction["operatingCost"]> = {};

  if (typeof fixedCost === "number") {
    operatingCost.fixedCost = fixedCost;
  }

  if (typeof costPerKm === "number") {
    operatingCost.costPerKm = costPerKm;
  }

  if (typeof costPerHour === "number") {
    operatingCost.costPerHour = costPerHour;
  }

  return Object.keys(operatingCost).length > 0 ? operatingCost : undefined;
}

function extractSharedOvertime(
  message: string,
): NonNullable<VehicleExtraction["operatingCost"]> {
  const overtimeAfterHours = firstNumber(
    message,
    /dopo\s+(\d+(?:[,.]\d+)?)\s+ore/i,
  );
  const overtimeCostPerHour = firstNumber(
    message,
    new RegExp(
      `overtime[\\s\\S]{0,80}?${moneyPattern}\\s*(\\d+(?:[,.]\\d+)?)\\s*\\/\\s*(?:ora|hour|h)\\b`,
      "i",
    ),
  );
  const operatingCost: NonNullable<VehicleExtraction["operatingCost"]> = {};

  if (typeof overtimeAfterHours === "number") {
    operatingCost.overtimeAfterMinutes = Math.round(overtimeAfterHours * 60);
  }

  if (typeof overtimeCostPerHour === "number") {
    operatingCost.overtimeCostPerHour = overtimeCostPerHour;
  }

  return operatingCost;
}

function extractWeightedStrategy(message: string): OptimizationStrategy | undefined {
  const objectivePatterns = [
    {
      type: "minimize_operating_cost" as const,
      pattern: /costo\s+operativo\s*:\s*(\d+(?:[,.]\d+)?)\s*%/i,
    },
    {
      type: "minimize_time" as const,
      pattern: /tempo\s*:\s*(\d+(?:[,.]\d+)?)\s*%/i,
    },
    {
      type: "minimize_distance" as const,
      pattern: /distanza\s*:\s*(\d+(?:[,.]\d+)?)\s*%/i,
    },
    {
      type: "minimize_vehicles" as const,
      pattern: /numero\s+di\s+veicoli\s*:\s*(\d+(?:[,.]\d+)?)\s*%/i,
    },
    {
      type: "balance_workload" as const,
      pattern: /bilanciamento\s+del\s+lavoro\s*:\s*(\d+(?:[,.]\d+)?)\s*%/i,
    },
  ];
  const objectives = objectivePatterns
    .map((item, index) => {
      const value = firstNumber(message, item.pattern);

      if (typeof value !== "number") {
        return null;
      }

      return {
        type: item.type,
        enabled: value > 0,
        priority: index + 1,
        weight: value / 100,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  if (objectives.length === 0) {
    return undefined;
  }

  return {
    mode: "advanced",
    objectives,
  };
}

function extractPriorityStrategy(message: string): OptimizationStrategy | undefined {
  const orderedMatches = [
    ...message.matchAll(
      /(?:^|\n)\s*(\d+)[.)]\s*minimizz(?:are|a)\s+(?:il\s+|la\s+|i\s+|le\s+)?([^\n]+)/gi,
    ),
  ]
    .map((match) => ({
      order: Number.parseInt(match[1], 10),
      objective: objectiveFromText(match[2]),
    }))
    .filter(
      (item): item is { order: number; objective: OptimizationObjectiveType } =>
        Boolean(item.objective),
    )
    .sort((first, second) => first.order - second.order);
  const uniqueObjectives = [
    ...new Map(
      orderedMatches.map((item) => [item.objective, item.objective]),
    ).values(),
  ];

  if (uniqueObjectives.length === 0) {
    return undefined;
  }

  return {
    mode: "priority",
    objectives: uniqueObjectives.map((type, index) => ({
      type,
      enabled: true,
      priority: index + 1,
    })),
  };
}

function dimensionsForVehicles(
  vehicles: VehicleExtraction[],
): CapacityDimensionDefinition[] {
  const keys = new Set(
    vehicles.flatMap((vehicle) => Object.keys(vehicle.capacities ?? {})),
  );

  return Object.entries(capacityDefinitions)
    .filter(([key]) => keys.has(key))
    .map(([, definition]) => definition);
}

function mergeProblemPatches(
  extractionPatch: RoutingProblemPatch,
  deterministicPatch: RoutingProblemPatch,
): RoutingProblemPatch {
  return {
    ...extractionPatch,
    ...deterministicPatch,
    capacityDimensions: mergeCapacityDimensions(
      extractionPatch.capacityDimensions,
      deterministicPatch.capacityDimensions,
    ),
    vehicles: deterministicPatch.vehicles?.length
      ? deterministicPatch.vehicles
      : extractionPatch.vehicles,
    optimizationStrategy:
      deterministicPatch.optimizationStrategy ??
      extractionPatch.optimizationStrategy,
  };
}

function mergeConversationOperations(
  baseOperations: NonNullable<RoutingExtraction["operations"]>,
  deterministicOperations: NonNullable<RoutingExtraction["operations"]>,
) {
  if (deterministicOperations.length === 0) {
    return baseOperations;
  }

  const deterministicTypes = new Set(
    deterministicOperations.map((operation) => operation.type),
  );
  const filteredBaseOperations = baseOperations.filter((operation) => {
    if (
      deterministicTypes.has("SET_DEPOT") &&
      operation.type === "SET_DEPOT"
    ) {
      return false;
    }

    if (
      deterministicTypes.has("SET_RETURN_TO_DEPOT") &&
      operation.type === "SET_RETURN_TO_DEPOT"
    ) {
      return false;
    }

    if (
      hasDeterministicStrategy(deterministicTypes) &&
      isStrategyOperation(operation.type)
    ) {
      return false;
    }

    if (
      hasDeterministicVehicles(deterministicOperations) &&
      isVehicleSetupOperation(operation.type)
    ) {
      return false;
    }

    return true;
  });

  return dedupeConversationOperations([
    ...filteredBaseOperations,
    ...deterministicOperations,
  ]);
}

function hasDeterministicStrategy(operationTypes: Set<string>) {
  return (
    operationTypes.has("SET_STRATEGY_PRESET") ||
    operationTypes.has("SET_STRATEGY_PRIORITY") ||
    operationTypes.has("SET_STRATEGY_WEIGHTS")
  );
}

function hasDeterministicVehicles(
  operations: NonNullable<RoutingExtraction["operations"]>,
) {
  return operations.some(
    (operation) =>
      operation.type === "ADD_VEHICLE" ||
      operation.type === "UPDATE_VEHICLE" ||
      operation.type === "SET_VEHICLE_COUNT",
  );
}

function isStrategyOperation(type: string) {
  return (
    type === "SET_STRATEGY_PRESET" ||
    type === "SET_STRATEGY_PRIORITY" ||
    type === "SET_STRATEGY_WEIGHTS"
  );
}

function isVehicleSetupOperation(type: string) {
  return (
    type === "ADD_VEHICLE" ||
    type === "UPDATE_VEHICLE" ||
    type === "SET_VEHICLE_COUNT"
  );
}

function dedupeConversationOperations(
  operations: NonNullable<RoutingExtraction["operations"]>,
) {
  const seen = new Set<string>();
  const deduped: NonNullable<RoutingExtraction["operations"]> = [];

  operations.forEach((operation) => {
    const key = operationIdentity(operation);

    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    deduped.push(operation);
  });

  return deduped;
}

function operationIdentity(
  operation: NonNullable<RoutingExtraction["operations"]>[number],
) {
  if (operation.type === "ADD_CAPACITY_DIMENSION") {
    return `${operation.type}:${operation.dimension.key}`;
  }

  if (operation.type === "ADD_VEHICLE") {
    return `${operation.type}:${operation.vehicle.name ?? ""}`;
  }

  return JSON.stringify(operation);
}

function mergeCapacityDimensions(
  first: CapacityDimensionDefinition[] | undefined,
  second: CapacityDimensionDefinition[] | undefined,
) {
  const byKey = new Map<string, CapacityDimensionDefinition>();

  [...(first ?? []), ...(second ?? [])].forEach((dimension) => {
    byKey.set(dimension.key, dimension);
  });

  return byKey.size > 0 ? [...byKey.values()] : undefined;
}

function hasPatchContent(patch: RoutingProblemPatch) {
  return Object.keys(patch).length > 0;
}

function firstNumber(text: string, pattern: RegExp) {
  const match = pattern.exec(text);

  if (!match) {
    return undefined;
  }

  const value = match.slice(1).find((item) => typeof item === "string");

  return value ? Number.parseFloat(value.replace(",", ".")) : undefined;
}

function normalizeMessageForParsing(message: string) {
  return message
    .replace(/\r\n/g, "\n")
    .replaceAll("\u00e2\u20ac\u201d", "\u2014")
    .replaceAll("\u00e2\u20ac\u201c", "\u2013")
    .replaceAll("\u00e2\u201a\u00ac", "\u20ac")
    .replaceAll("\u00c3\u00a8", "\u00e8")
    .replaceAll("\u00c3\u00a0", "\u00e0")
    .replaceAll("\u00c2\u00b3", "\u00b3")
    .replace(/\s+(VEICOLO\s+\d+\s*[\u2014\u2013-])/gi, "\n$1")
    .replace(/\s+((?:Van|Truck|Furgone|Camion|Vehicle)[^:\n]{0,60}:)/gi, "\n$1")
    .replace(/\s+(\d+[.)]\s*minimizz)/gi, "\n$1")
    .replace(new RegExp(`\\s+(${sectionBoundary})\\b`, "gi"), "\n$1");
}

function cleanVehicleName(name: string) {
  return name
    .replace(/\bCapacit(?:a|\u00e0)\b[\s\S]*$/i, "")
    .replace(/\bCosti?\b[\s\S]*$/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[:\-\u2013\u2014]+$/g, "")
    .trim();
}

function hasVehicleFacts(body: string) {
  return /kg\b|m\u00b3|m3\b|pallet|bancali|colli|packages|\u20ac|eur\b|euro|capacit/i.test(
    body,
  );
}

function dedupeVehicles(vehicles: VehicleExtraction[]) {
  const byName = new Map<string, VehicleExtraction>();

  vehicles.forEach((vehicle) => {
    if (!vehicle.name) {
      return;
    }

    const key = vehicle.name.toLowerCase();
    const existing = byName.get(key);

    byName.set(key, {
      ...existing,
      ...vehicle,
      capacities: {
        ...(existing?.capacities ?? {}),
        ...(vehicle.capacities ?? {}),
      },
      operatingCost: {
        ...(existing?.operatingCost ?? {}),
        ...(vehicle.operatingCost ?? {}),
      },
    });
  });

  return [...byName.values()];
}

function objectiveFromText(value: string): OptimizationObjectiveType | undefined {
  const normalized = value.toLowerCase();

  if (normalized.includes("tempo")) {
    return "minimize_time";
  }

  if (normalized.includes("distanza") || normalized.includes("km")) {
    return "minimize_distance";
  }

  if (normalized.includes("costo")) {
    return "minimize_operating_cost";
  }

  if (normalized.includes("veicoli")) {
    return "minimize_vehicles";
  }

  if (normalized.includes("bilanciamento") || normalized.includes("lavoro")) {
    return "balance_workload";
  }

  return undefined;
}
