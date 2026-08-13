import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import ts from "typescript";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outputDir = join(root, ".tmp", "conversation-capacity-tests");

const sources = [
  "capacity",
  "optimization-strategy",
  "formatters",
  "routing-validation",
  "problem-understanding",
  "conversation-readiness",
  "conversation-patch-operations",
  "locations",
  "conversation-engine",
  "vehicle-text-extraction",
  "apply-routing-extraction",
  "problem-sidebar-model",
];

mkdirSync(outputDir, { recursive: true });

for (const sourceName of sources) {
  const sourcePath = join(root, "lib", `${sourceName}.ts`);
  let source = readFileSync(sourcePath, "utf8");

  source = source
    .replaceAll("@/lib/capacity", "./capacity.cjs")
    .replaceAll("@/lib/optimization-strategy", "./optimization-strategy.cjs")
    .replaceAll("@/lib/formatters", "./formatters.cjs")
    .replaceAll("@/lib/routing-validation", "./routing-validation.cjs")
    .replaceAll("@/lib/problem-understanding", "./problem-understanding.cjs")
    .replaceAll("@/lib/conversation-readiness", "./conversation-readiness.cjs")
    .replaceAll(
      "@/lib/conversation-patch-operations",
      "./conversation-patch-operations.cjs",
    )
    .replaceAll("@/lib/locations", "./locations.cjs")
    .replaceAll("@/lib/vehicle-text-extraction", "./vehicle-text-extraction.cjs");

  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  });

  writeFileSync(join(outputDir, `${sourceName}.cjs`), compiled.outputText);
}

const require = createRequire(import.meta.url);
const {
  applyConversationAnswer,
  composeImportReadinessMessage,
  composeImportReadinessNote,
  deriveConversationAction,
  getNextQuestion,
} = require(join(outputDir, "conversation-engine.cjs"));
const {
  assessConversationReadiness,
} = require(join(outputDir, "conversation-readiness.cjs"));
const {
  getVehicleCapacityRequirements,
  hasCompleteVehicleCapacities,
  validateRoutingProblem,
} = require(join(outputDir, "routing-validation.cjs"));
const {
  extractDeterministicRoutingPatch,
  mergeDeterministicRoutingFacts,
} = require(join(outputDir, "vehicle-text-extraction.cjs"));
const {
  applyRoutingExtraction,
} = require(join(outputDir, "apply-routing-extraction.cjs"));
const {
  buildProblemSidebarSections,
  buildSidebarSyncSnapshot,
} = require(join(outputDir, "problem-sidebar-model.cjs"));

const baseProblem = {
  id: "problem-capacity-loop",
  name: "Capacity loop",
  depot: { address: "Bologna" },
  capacityDimensions: [
    { key: "weight", label: "Weight", unit: "kg", valueType: "decimal" },
  ],
  vehicles: [
    { id: "veh-verona", name: "Van Verona" },
    { id: "veh-cargo", name: "Van Cargo" },
    { id: "veh-truck", name: "Truck" },
    { id: "veh-small", name: "Small Van" },
  ],
  stops: [
    {
      id: "stop-1",
      name: "Rossi",
      address: "Via Roma 1",
      demands: { weight: 300 },
    },
  ],
  returnToDepot: true,
  optimizationStrategy: {
    mode: "preset",
    preset: "fastest",
    objectives: [
      { type: "minimize_time", enabled: true, priority: 1 },
      { type: "minimize_distance", enabled: true, priority: 2 },
    ],
  },
  status: "collecting",
};

try {
  const firstQuestion = getNextQuestion(baseProblem);
  assert.equal(firstQuestion?.id, "vehicle-capacities");
  assert.deepEqual(firstQuestion.capacityDimensions.map((item) => item.key), [
    "weight",
  ]);
  const readinessBeforeCapacity = assessConversationReadiness(baseProblem);
  const actionBeforeCapacity = deriveConversationAction(baseProblem);

  assert.equal(readinessBeforeCapacity.readyForReview, false);
  assert.equal(actionBeforeCapacity.type, "ASK_MISSING_INFORMATION");
  assert.equal(actionBeforeCapacity.question.id, "vehicle-capacities");

  const updatedProblem = applyConversationAnswer(baseProblem, firstQuestion, [
    { vehicleId: "veh-verona", dimensionKey: "weight", capacity: 1100 },
    { vehicleId: "veh-cargo", dimensionKey: "weight", capacity: 1500 },
    { vehicleId: "veh-truck", dimensionKey: "weight", capacity: 2300 },
    { vehicleId: "veh-small", dimensionKey: "weight", capacity: 900 },
  ]);

  assert.deepEqual(
    updatedProblem.vehicles.map((vehicle) => vehicle.capacities.weight),
    [1100, 1500, 2300, 900],
  );
  assert.equal(hasCompleteVehicleCapacities(updatedProblem), true);
  assert.notEqual(getNextQuestion(updatedProblem)?.id, "vehicle-capacities");
  assert.equal(validateRoutingProblem(updatedProblem).ready, true);
  assert.equal(deriveConversationAction(updatedProblem).type, "PROCEED_TO_REVIEW");

  const twoDimensionProblem = {
    ...baseProblem,
    capacityDimensions: [
      { key: "weight", label: "Weight", unit: "kg", valueType: "decimal" },
      { key: "pallets", label: "Pallets", unit: "pallets", valueType: "integer" },
    ],
    vehicles: baseProblem.vehicles.map((vehicle) => ({
      ...vehicle,
      capacities: { weight: 1000 },
    })),
    stops: [
      {
        ...baseProblem.stops[0],
        demands: { weight: 300, pallets: 2 },
      },
    ],
  };
  const requirements = getVehicleCapacityRequirements(twoDimensionProblem);

  assert.deepEqual(requirements.map((item) => item.dimension.key), ["pallets"]);

  const completedTwoDimensionProblem = applyConversationAnswer(
    twoDimensionProblem,
    getNextQuestion(twoDimensionProblem),
    twoDimensionProblem.vehicles.map((vehicle) => ({
      vehicleId: vehicle.id,
      dimensionKey: "pallets",
      capacity: 8,
    })),
  );

  assert.equal(hasCompleteVehicleCapacities(completedTwoDimensionProblem), true);

  const legacyProblem = {
    ...baseProblem,
    capacityDimensions: undefined,
    vehicles: [{ id: "vehicle-1", name: "Renamed Van", capacity: 800 }],
    stops: [
      {
        id: "stop-1",
        name: "Legacy stop",
        address: "Via Roma 1",
        demand: 120,
      },
    ],
  };

  assert.equal(validateRoutingProblem(legacyProblem).ready, true);

  const renamedProblem = {
    ...baseProblem,
    vehicles: [
      { id: "stable-a", name: "Truck" },
      { id: "stable-b", name: "Truck" },
    ],
  };
  const renamedQuestion = getNextQuestion(renamedProblem);
  const renamedUpdatedProblem = applyConversationAnswer(
    renamedProblem,
    renamedQuestion,
    [
      { vehicleId: "stable-b", dimensionKey: "weight", capacity: 900 },
      { vehicleId: "stable-a", dimensionKey: "weight", capacity: 1500 },
    ],
  );

  assert.deepEqual(
    renamedUpdatedProblem.vehicles.map((vehicle) => [
      vehicle.id,
      vehicle.capacities.weight,
    ]),
    [
      ["stable-a", 1500],
      ["stable-b", 900],
    ],
  );

  const overloadedProblem = {
    ...baseProblem,
    stops: [
      {
        id: "stop-1",
        name: "Rossi",
        address: "Via Roma 1",
        demands: { weight: 7000 },
      },
    ],
  };
  const overloadedQuestion = getNextQuestion(overloadedProblem);
  const overloadedUpdatedProblem = applyConversationAnswer(
    overloadedProblem,
    overloadedQuestion,
    [
      { vehicleId: "veh-verona", dimensionKey: "weight", capacity: 1100 },
      { vehicleId: "veh-cargo", dimensionKey: "weight", capacity: 1500 },
      { vehicleId: "veh-truck", dimensionKey: "weight", capacity: 2300 },
      { vehicleId: "veh-small", dimensionKey: "weight", capacity: 900 },
    ],
  );
  const overloadedNextQuestion = getNextQuestion(overloadedUpdatedProblem);
  const overloadedAction = deriveConversationAction(overloadedUpdatedProblem);

  assert.equal(hasCompleteVehicleCapacities(overloadedUpdatedProblem), true);
  assert.equal(overloadedNextQuestion, null);
  assert.equal(overloadedAction.type, "SHOW_CONFLICT");
  assert.notEqual(overloadedNextQuestion?.id, "vehicle-capacities");

  const structuredVehicleMessage = `
Organizza le consegne del file che ho appena caricato.
Il deposito è: Via Sommacampagna 63/H, 37137 Verona VR, Italy
Ho 4 veicoli con capacità e costi differenti.
VEICOLO 1 — Van Verona
Capacità:
- 1100 kg
- 11 m³
- 8 pallet
- 80 colli
Costi:
- €40 costo fisso se utilizzato
- €0,31/km
- €20/ora di lavoro
VEICOLO 2 — Van Cargo
Capacità:
- 1500 kg
- 14 m³
- 10 pallet
- 100 colli
Costi:
- €52 costo fisso se utilizzato
- €0,29/km
- €21/ora di lavoro
VEICOLO 3 — Truck
Capacità:
- 2300 kg
- 22 m³
- 16 pallet
- 145 colli
Costi:
- €85 costo fisso se utilizzato
- €0,39/km
- €25/ora di lavoro
VEICOLO 4 — Small Van
Capacità:
- 900 kg
- 9 m³
- 6 pallet
- 60 colli
Costi:
- €28 costo fisso se utilizzato
- €0,26/km
- €18/ora di lavoro
Per tutti i veicoli:
- dopo 8 ore di lavoro applica un overtime premium di €15/ora
- devono tornare al deposito al termine del giro
Usa questa strategia di ottimizzazione personalizzata:
- costo operativo: 40%
- tempo: 30%
- distanza: 15%
- numero di veicoli: 10%
- bilanciamento del lavoro: 5%
`;
  const deterministicPatch = extractDeterministicRoutingPatch(
    structuredVehicleMessage,
  );
  const realUnicodePatch = extractDeterministicRoutingPatch(`
Organizza le consegne del file che ho appena caricato.
Il deposito è: Via Sommacampagna 63/H, 37137 Verona VR, Italy
Ho 4 veicoli con capacità e costi differenti.
VEICOLO 1 — Van Verona
Capacità:
- 1100 kg
- 11 m³
- 8 pallet
- 80 colli
Costi:
- €40 costo fisso se utilizzato
- €0,31/km
- €20/ora di lavoro
VEICOLO 2 — Van Cargo
Capacità:
- 1500 kg
- 14 m³
- 10 pallet
- 100 colli
Costi:
- €52 costo fisso se utilizzato
- €0,29/km
- €21/ora di lavoro
VEICOLO 3 — Truck
Capacità:
- 2300 kg
- 22 m³
- 16 pallet
- 145 colli
Costi:
- €85 costo fisso se utilizzato
- €0,39/km
- €25/ora di lavoro
VEICOLO 4 — Small Van
Capacità:
- 900 kg
- 9 m³
- 6 pallet
- 60 colli
Costi:
- €28 costo fisso se utilizzato
- €0,26/km
- €18/ora di lavoro
Per tutti i veicoli:
- dopo 8 ore di lavoro applica un overtime premium di €15/ora
- devono tornare al deposito al termine del giro
Usa questa strategia di ottimizzazione personalizzata:
- costo operativo: 40%
- tempo: 30%
- distanza: 15%
- numero di veicoli: 10%
- bilanciamento del lavoro: 5%
`);

  assert.equal(deterministicPatch.vehicleCount, 4);
  assert.equal(realUnicodePatch.vehicleCount, 4);
  assert.equal(
    deterministicPatch.depot,
    "Via Sommacampagna 63/H, 37137 Verona VR, Italy",
  );
  assert.equal(
    realUnicodePatch.depot,
    "Via Sommacampagna 63/H, 37137 Verona VR, Italy",
  );
  assert.deepEqual(deterministicPatch.capacityDimensions.map((item) => item.key), [
    "weight",
    "volume",
    "pallets",
    "packages",
  ]);
  assert.deepEqual(
    deterministicPatch.vehicles.map((vehicle) => [
      vehicle.name,
      vehicle.capacities.weight,
      vehicle.capacities.volume,
      vehicle.capacities.pallets,
      vehicle.capacities.packages,
      vehicle.operatingCost.fixedCost,
      vehicle.operatingCost.costPerKm,
      vehicle.operatingCost.costPerHour,
      vehicle.operatingCost.overtimeAfterMinutes,
      vehicle.operatingCost.overtimeCostPerHour,
    ]),
    [
      ["Van Verona", 1100, 11, 8, 80, 40, 0.31, 20, 480, 15],
      ["Van Cargo", 1500, 14, 10, 100, 52, 0.29, 21, 480, 15],
      ["Truck", 2300, 22, 16, 145, 85, 0.39, 25, 480, 15],
      ["Small Van", 900, 9, 6, 60, 28, 0.26, 18, 480, 15],
    ],
  );
  assert.deepEqual(
    realUnicodePatch.vehicles.map((vehicle) => [
      vehicle.name,
      vehicle.capacities.weight,
      vehicle.capacities.volume,
      vehicle.capacities.pallets,
      vehicle.capacities.packages,
    ]),
    [
      ["Van Verona", 1100, 11, 8, 80],
      ["Van Cargo", 1500, 14, 10, 100],
      ["Truck", 2300, 22, 16, 145],
      ["Small Van", 900, 9, 6, 60],
    ],
  );
  assert.equal(deterministicPatch.currency, "EUR");
  assert.equal(deterministicPatch.returnToDepot, true);
  assert.equal(deterministicPatch.optimizationStrategy.mode, "advanced");
  assert.deepEqual(
    deterministicPatch.optimizationStrategy.objectives.map((objective) => [
      objective.type,
      objective.weight,
    ]),
    [
      ["minimize_operating_cost", 0.4],
      ["minimize_time", 0.3],
      ["minimize_distance", 0.15],
      ["minimize_vehicles", 0.1],
      ["balance_workload", 0.05],
    ],
  );

  const importedStops = Array.from({ length: 16 }, (_, index) => ({
    id: `D${String(index + 1).padStart(3, "0")}`,
    name: `Stop ${index + 1}`,
    address: `Address ${index + 1}`,
    demands: {
      weight: 100,
      volume: 0.5,
      pallets: 0.25,
      packages: 4,
    },
    serviceTimeSeconds: 900,
    timeWindow: { start: "09:00", end: "17:00", mode: "hard" },
    servicePolicy: "required",
    priority: "normal",
  }));
  const importedProblem = {
    id: "real-italian-turn",
    name: "Real Italian turn",
    depot: undefined,
    capacityDimensions: [
      { key: "weight", label: "Weight", unit: "kg", valueType: "decimal" },
      { key: "volume", label: "Volume", unit: "m3", valueType: "decimal" },
      { key: "pallets", label: "Pallets", unit: "pallets", valueType: "integer" },
      { key: "packages", label: "Packages", unit: "pcs", valueType: "integer" },
    ],
    vehicles: [],
    stops: importedStops,
    returnToDepot: undefined,
    status: "collecting",
  };
  const importReadinessMessage = composeImportReadinessMessage(importedProblem, {
    fileName: "routespilot_multicapacity_stress_test_v2.csv",
    importedStopCount: 16,
  });

  assert.match(importReadinessMessage, /Ho caricato 16 consegne/);
  assert.match(importReadinessMessage, /Non posso ancora procedere/);
  assert.match(importReadinessMessage, /deposito/);
  assert.match(importReadinessMessage, /veicolo/);
  assert.match(composeImportReadinessNote(importedProblem), /Mancano ancora/);

  const emptyGeminiExtraction = {
    problemPatch: {},
    confidence: "high",
    ambiguities: [],
  };
  const mergedFullTurnExtraction = mergeDeterministicRoutingFacts(
    emptyGeminiExtraction,
    structuredVehicleMessage,
  );
  const fullTurnProblem = applyRoutingExtraction(
    importedProblem,
    mergedFullTurnExtraction,
  );

  assert.equal(fullTurnProblem.stops.length, 16);
  assert.equal(fullTurnProblem.depot.address, "Via Sommacampagna 63/H, 37137 Verona VR, Italy");
  assert.equal(fullTurnProblem.vehicles.length, 4);
  assert.equal(fullTurnProblem.returnToDepot, true);
  assert.equal(hasCompleteVehicleCapacities(fullTurnProblem), true);
  assert.equal(getNextQuestion(fullTurnProblem), null);
  assert.equal(validateRoutingProblem(fullTurnProblem).ready, true);
  assert.deepEqual(
    fullTurnProblem.capacityDimensions.map((dimension) => dimension.key),
    ["weight", "volume", "pallets", "packages"],
  );

  const backendVehicleOperationsExtraction = {
    patchSchemaVersion: "operations_v1",
    problemPatch: {},
    operations: [
      { type: "SET_DEPOT", address: "Via Sommacampagna 63/H, 37137 Verona VR, Italy" },
      { type: "REMOVE_CAPACITY_DIMENSION", dimensionKey: "load" },
      {
        type: "ADD_CAPACITY_DIMENSION",
        dimension: { key: "weight", label: "Weight", unit: "kg", valueType: "decimal" },
      },
      {
        type: "ADD_CAPACITY_DIMENSION",
        dimension: { key: "volume", label: "Volume", unit: "m3", valueType: "decimal" },
      },
      {
        type: "ADD_CAPACITY_DIMENSION",
        dimension: { key: "pallets", label: "Pallets", unit: "pallets", valueType: "integer" },
      },
      {
        type: "ADD_CAPACITY_DIMENSION",
        dimension: { key: "packages", label: "Packages", unit: "pcs", valueType: "integer" },
      },
      {
        type: "ADD_VEHICLE",
        vehicle: {
          name: "Van Verona",
          capacities: { weight: 1100, volume: 11, pallets: 8, packages: 80 },
        },
      },
      {
        type: "ADD_VEHICLE",
        vehicle: {
          name: "Van Cargo",
          capacities: { weight: 1500, volume: 14, pallets: 10, packages: 100 },
        },
      },
      {
        type: "ADD_VEHICLE",
        vehicle: {
          name: "Truck",
          capacities: { weight: 2300, volume: 22, pallets: 16, packages: 145 },
        },
      },
      {
        type: "ADD_VEHICLE",
        vehicle: {
          name: "Small Van",
          capacities: { weight: 900, volume: 9, pallets: 6, packages: 60 },
        },
      },
      { type: "SET_RETURN_TO_DEPOT", returnToDepot: true },
      {
        type: "SET_STRATEGY_PRIORITY",
        objectives: [
          { type: "minimize_time", enabled: true, priority: 1 },
          { type: "minimize_distance", enabled: true, priority: 2 },
          { type: "minimize_vehicles", enabled: true, priority: 3 },
        ],
      },
      { type: "REQUEST_OPTIMIZATION" },
    ],
    confidence: "high",
    ambiguities: [],
  };
  const headingOnlyVehicleMessage = `
Organizza tutte le consegne del file che ho appena caricato.

Deposito:
Via Sommacampagna 63/H, 37137 Verona VR, Italy

Ho 4 veicoli con capacità multidimensionali.

Van Verona
* 1100 kg
* 11 m³
* 8 pallet
* 80 colli

Van Cargo
* 1500 kg
* 14 m³
* 10 pallet
* 100 colli

Truck
* 2300 kg
* 22 m³
* 16 pallet
* 145 colli

Small Van
* 900 kg
* 9 m³
* 6 pallet
* 60 colli

Tutti i veicoli devono partire dal deposito e tornare al deposito al termine del giro.
Non usare una capacità generica "load" e non ignorare nessuna delle quattro dimensioni.

Come strategia usa queste priorità:
1. minimizza il tempo totale
2. minimizza la distanza totale
3. minimizza il numero di veicoli utilizzati

Ottimizza il piano.
`;
  const mergedBackendVehicleExtraction = mergeDeterministicRoutingFacts(
    backendVehicleOperationsExtraction,
    headingOnlyVehicleMessage,
  );
  const backendVehicleProblem = applyRoutingExtraction(
    {
      ...importedProblem,
      capacityDimensions: [
        { key: "load", label: "Load", unit: "kg", valueType: "decimal" },
        ...importedProblem.capacityDimensions,
      ],
    },
    mergedBackendVehicleExtraction,
  );

  assert.equal(backendVehicleProblem.vehicles.length, 4);
  assert.deepEqual(
    backendVehicleProblem.vehicles.map((vehicle) => vehicle.name),
    ["Van Verona", "Van Cargo", "Truck", "Small Van"],
  );
  assert.equal(backendVehicleProblem.vehicles[0].capacities.weight, 1100);
  assert.equal(backendVehicleProblem.vehicles[0].capacities.volume, 11);
  assert.deepEqual(
    backendVehicleProblem.capacityDimensions.map((dimension) => dimension.key),
    ["weight", "volume", "pallets", "packages"],
  );

  const exactGeminiExtraction = {
    problemPatch: {
      depot: "Via Sommacampagna 63/H, 37137 Verona VR, Italy",
      currency: "EUR",
      vehicles: [
        {
          name: "Van Verona",
          capacities: { weight: 1100, volume: 11, pallets: 8, packages: 80 },
          operatingCost: {
            fixedCost: 40,
            costPerKm: 0.31,
            costPerHour: 20,
            overtimeCostPerHour: 15,
            overtimeAfterMinutes: 480,
          },
        },
        {
          name: "Van Cargo",
          capacities: { weight: 1500, volume: 14, pallets: 10, packages: 100 },
          operatingCost: {
            fixedCost: 52,
            costPerKm: 0.29,
            costPerHour: 21,
            overtimeCostPerHour: 15,
            overtimeAfterMinutes: 480,
          },
        },
        {
          name: "Truck",
          capacities: { weight: 2300, volume: 22, pallets: 16, packages: 145 },
          operatingCost: {
            fixedCost: 85,
            costPerKm: 0.39,
            costPerHour: 25,
            overtimeCostPerHour: 15,
            overtimeAfterMinutes: 480,
          },
        },
        {
          name: "Small Van",
          capacities: { weight: 900, volume: 9, pallets: 6, packages: 60 },
          operatingCost: {
            fixedCost: 28,
            costPerKm: 0.26,
            costPerHour: 18,
            overtimeCostPerHour: 15,
            overtimeAfterMinutes: 480,
          },
        },
      ],
      returnToDepot: true,
      optimizationStrategy: {
        mode: "advanced",
        objectives: [
          {
            type: "minimize_operating_cost",
            enabled: true,
            priority: 1,
            weight: 0.4,
          },
          { type: "minimize_time", enabled: true, priority: 2, weight: 0.3 },
          { type: "minimize_distance", enabled: true, priority: 3, weight: 0.15 },
          { type: "minimize_vehicles", enabled: true, priority: 4, weight: 0.1 },
          { type: "balance_workload", enabled: true, priority: 5, weight: 0.05 },
        ],
      },
    },
    confidence: "high",
    ambiguities: [],
  };
  const placeholderProblem = {
    ...importedProblem,
    vehicles: [{ id: "vehicle-1", name: "Van 1" }],
  };
  const exactPatchedProblem = applyRoutingExtraction(
    placeholderProblem,
    exactGeminiExtraction,
  );

  assert.deepEqual(
    exactPatchedProblem.vehicles.map((vehicle) => vehicle.name),
    ["Van Verona", "Van Cargo", "Truck", "Small Van"],
  );
  assert.deepEqual(
    exactPatchedProblem.vehicles.map((vehicle) => vehicle.capacities),
    [
      { weight: 1100, volume: 11, pallets: 8, packages: 80 },
      { weight: 1500, volume: 14, pallets: 10, packages: 100 },
      { weight: 2300, volume: 22, pallets: 16, packages: 145 },
      { weight: 900, volume: 9, pallets: 6, packages: 60 },
    ],
  );
  assert.deepEqual(
    exactPatchedProblem.vehicles.map((vehicle) => [
      vehicle.operatingCost.fixedCost,
      vehicle.operatingCost.costPerKm,
      vehicle.operatingCost.costPerHour,
      vehicle.operatingCost.overtimeCostPerHour,
      vehicle.operatingCost.overtimeAfterMinutes,
    ]),
    [
      [40, 0.31, 20, 15, 480],
      [52, 0.29, 21, 15, 480],
      [85, 0.39, 25, 15, 480],
      [28, 0.26, 18, 15, 480],
    ],
  );
  assert.equal(exactPatchedProblem.returnToDepot, true);
  assert.equal(exactPatchedProblem.optimizationStrategy.mode, "advanced");
  assert.equal(hasCompleteVehicleCapacities(exactPatchedProblem), true);
  assert.notEqual(getNextQuestion(exactPatchedProblem)?.id, "vehicle-capacities");

  const directOperationsProblem = applyRoutingExtraction(importedProblem, {
    patchSchemaVersion: "operations_v1",
    primaryIntent: "mutate_plan",
    problemPatch: {},
    operations: [
      {
        type: "SET_DEPOT",
        address: "Via Sommacampagna 63/H, 37137 Verona VR, Italy",
      },
      {
        type: "ADD_VEHICLE",
        vehicle: {
          name: "Van Verona",
          capacities: { weight: 1100, volume: 11, pallets: 8, packages: 80 },
          operatingCost: {
            fixedCost: 40,
            costPerKm: 0.31,
            costPerHour: 20,
            overtimeAfterMinutes: 480,
            overtimeCostPerHour: 15,
          },
        },
      },
      {
        type: "ADD_VEHICLE",
        vehicle: {
          name: "Van Cargo",
          capacities: { weight: 1500, volume: 14, pallets: 10, packages: 100 },
          operatingCost: {
            fixedCost: 52,
            costPerKm: 0.29,
            costPerHour: 21,
            overtimeAfterMinutes: 480,
            overtimeCostPerHour: 15,
          },
        },
      },
      {
        type: "ADD_VEHICLE",
        vehicle: {
          name: "Truck",
          capacities: { weight: 2300, volume: 22, pallets: 16, packages: 145 },
          operatingCost: {
            fixedCost: 85,
            costPerKm: 0.39,
            costPerHour: 25,
            overtimeAfterMinutes: 480,
            overtimeCostPerHour: 15,
          },
        },
      },
      {
        type: "ADD_VEHICLE",
        vehicle: {
          name: "Small Van",
          capacities: { weight: 900, volume: 9, pallets: 6, packages: 60 },
          operatingCost: {
            fixedCost: 28,
            costPerKm: 0.26,
            costPerHour: 18,
            overtimeAfterMinutes: 480,
            overtimeCostPerHour: 15,
          },
        },
      },
      { type: "SET_RETURN_TO_DEPOT", returnToDepot: true },
      {
        type: "SET_STRATEGY_WEIGHTS",
        objectives: [
          {
            type: "minimize_operating_cost",
            enabled: true,
            priority: 1,
            weight: 0.4,
          },
          { type: "minimize_time", enabled: true, priority: 2, weight: 0.3 },
          { type: "minimize_distance", enabled: true, priority: 3, weight: 0.15 },
          { type: "minimize_vehicles", enabled: true, priority: 4, weight: 0.1 },
          { type: "balance_workload", enabled: true, priority: 5, weight: 0.05 },
        ],
      },
      { type: "REQUEST_OPTIMIZATION" },
    ],
    confidence: "high",
    ambiguities: [],
  });

  assert.equal(directOperationsProblem.stops.length, 16);
  assert.deepEqual(
    directOperationsProblem.vehicles.map((vehicle) => vehicle.name),
    ["Van Verona", "Van Cargo", "Truck", "Small Van"],
  );
  assert.deepEqual(
    directOperationsProblem.capacityDimensions.map((dimension) => dimension.key),
    ["weight", "volume", "pallets", "packages"],
  );
  assert.equal(hasCompleteVehicleCapacities(directOperationsProblem), true);
  assert.notEqual(
    getNextQuestion(directOperationsProblem)?.id,
    "vehicle-capacities",
  );

  const partialVehicleProblem = {
    ...importedProblem,
    capacityDimensions: [
      { key: "weight", label: "Weight", unit: "kg", valueType: "decimal" },
      { key: "pallets", label: "Pallets", unit: "pallets", valueType: "integer" },
    ],
    vehicles: [
      {
        id: "stable-van-verona",
        name: "Van Verona",
        capacities: { weight: 1100 },
      },
    ],
  };
  const partialVehiclePatch = applyRoutingExtraction(partialVehicleProblem, {
    problemPatch: {
      vehicles: [{ name: "Van Verona", capacities: { pallets: 8 } }],
    },
    confidence: "high",
    ambiguities: [],
  });

  assert.equal(partialVehiclePatch.vehicles.length, 1);
  assert.equal(partialVehiclePatch.vehicles[0].id, "stable-van-verona");
  assert.deepEqual(partialVehiclePatch.vehicles[0].capacities, {
    weight: 1100,
    pallets: 8,
  });

  const malformedVehicleProblem = applyRoutingExtraction(
    {
      ...baseProblem,
      vehicles: [],
    },
    {
      problemPatch: {
        vehicles: [
          {
            name: "Van Verona Capacità: - 1100 kg VEICOLO 2 — Van Cargo",
            capacities: { weight: 1100 },
          },
        ],
      },
      confidence: "high",
      ambiguities: [],
    },
  );

  assert.equal(malformedVehicleProblem.vehicles.length, 0);

  const parmaImportedStops = Array.from({ length: 16 }, (_, index) => ({
    id: `parma-${index + 1}`,
    name: `Parma Stop ${index + 1}`,
    address: `Via Test ${index + 1}, Parma`,
    demands: { weight: 50, pallets: 1 },
    servicePolicy: "required",
    priority: "normal",
    timeWindow: { start: "09:00", end: "17:00", mode: "hard" },
    serviceTimeSeconds: 600,
  }));
  const parmaProblem = {
    id: "parma-sidebar-sync",
    name: "Parma sidebar sync",
    depot: undefined,
    capacityDimensions: [
      { key: "weight", label: "Weight", unit: "kg", valueType: "decimal" },
      { key: "pallets", label: "Pallets", unit: "pallets", valueType: "integer" },
    ],
    vehicles: [],
    stops: parmaImportedStops,
    returnToDepot: undefined,
    status: "collecting",
  };
  const parmaTurn = `
Organizza le consegne del file che ho appena caricato.
Il deposito e': Via Emilia Ovest 90, Parma, Italy
Ho 2 veicoli.
Van Parma:
- capacita 900 kg
- 8 pallet
Truck Parma:
- capacita 1600 kg
- 14 pallet
Entrambi i veicoli devono partire dal deposito e tornare al deposito alla fine del giro.
Tutte le consegne sono obbligatorie.
Come strategia voglio:
1. minimizzare il tempo
2. minimizzare la distanza
Ottimizza il piano.
`;
  const parmaExtraction = mergeDeterministicRoutingFacts(
    {
      problemPatch: {},
      confidence: "high",
      ambiguities: [],
    },
    parmaTurn,
  );
  const parmaPatchedProblem = applyRoutingExtraction(parmaProblem, parmaExtraction);
  const parmaSidebarSections = buildProblemSidebarSections({
    importedFile: {
      id: "parma-file",
      fileName: "routes_parma.csv",
      status: "success",
      rowCount: 16,
      validRowCount: 16,
    },
    problem: parmaPatchedProblem,
  });
  const parmaSidebarSnapshot = buildSidebarSyncSnapshot(parmaPatchedProblem);
  const routeSection = parmaSidebarSections.find(
    (section) => section.label === "Route",
  );
  const deliveriesSection = parmaSidebarSections.find(
    (section) => section.label === "Deliveries",
  );
  const vehiclesSection = parmaSidebarSections.find(
    (section) => section.label === "Vehicles",
  );
  const optimizationSection = parmaSidebarSections.find(
    (section) => section.label === "Optimization",
  );

  assert.equal(parmaPatchedProblem.stops.length, 16);
  assert.equal(parmaPatchedProblem.vehicles.length, 2);
  assert.match(parmaPatchedProblem.depot.address, /Parma/);
  assert.equal(parmaPatchedProblem.optimizationStrategy.mode, "priority");
  assert.deepEqual(
    parmaPatchedProblem.optimizationStrategy.objectives.map((objective) => objective.type),
    ["minimize_time", "minimize_distance"],
  );
  assert.equal(hasCompleteVehicleCapacities(parmaPatchedProblem), true);
  assert.equal(routeSection.summary, "Via Emilia Ovest 90, Parma");
  assert.equal(deliveriesSection.summary, "16 stops");
  assert.equal(vehiclesSection.summary, "2 vehicles");
  assert.equal(vehiclesSection.status, "complete");
  assert.deepEqual(vehiclesSection.details, [
    "Van Parma: 900 kg · 8 pallets",
    "Truck Parma: 1600 kg · 14 pallets",
  ]);
  assert.equal(optimizationSection.summary, "Time -> Distance");
  assert.deepEqual(parmaSidebarSnapshot, {
    depot: "Via Emilia Ovest 90, Parma, Italy",
    vehicles: 2,
    stops: 16,
    strategy: "Time -> Distance",
  });

  const noLoadProblem = {
    id: "no-load-problem",
    name: "No load problem",
    depot: { address: "Parma" },
    vehicles: [{ id: "van-1", name: "Van 1" }],
    stops: [{ id: "stop-1", name: "Bologna", address: "Bologna" }],
    returnToDepot: true,
    optimizationStrategy: {
      mode: "preset",
      preset: "fastest",
      objectives: [
        { type: "minimize_time", enabled: true, priority: 1 },
        { type: "minimize_distance", enabled: true, priority: 2 },
      ],
    },
    status: "collecting",
  };

  assert.equal(validateRoutingProblem(noLoadProblem).ready, true);
  assert.equal(assessConversationReadiness(noLoadProblem).readyForReview, true);
  assert.equal(getNextQuestion(noLoadProblem), null);

  const capacityConflictProblem = {
    id: "capacity-conflict",
    name: "Capacity conflict",
    depot: { address: "Parma" },
    capacityDimensions: [
      { key: "weight", label: "Weight", unit: "kg", valueType: "decimal" },
    ],
    vehicles: [
      { id: "van-1", name: "Van 1", capacities: { weight: 100 } },
    ],
    stops: [
      {
        id: "stop-1",
        name: "Bologna",
        address: "Bologna",
        demands: { weight: 200 },
        servicePolicy: "required",
      },
    ],
    returnToDepot: true,
    status: "collecting",
  };
  const capacityConflictAction = deriveConversationAction(capacityConflictProblem);

  assert.equal(getNextQuestion(capacityConflictProblem), null);
  assert.equal(capacityConflictAction.type, "SHOW_CONFLICT");
  assert.match(capacityConflictAction.message, /weight demand exceeds/);

  console.log("conversation-capacity: capacity and sidebar sync tests passed");
} finally {
  rmSync(outputDir, { force: true, recursive: true });
}
