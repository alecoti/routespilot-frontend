import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import ts from "typescript";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const sourcePath = join(root, "lib", "routing-validation.ts");
const capacitySourcePath = join(root, "lib", "capacity.ts");
const strategySourcePath = join(root, "lib", "optimization-strategy.ts");
const outputDir = join(root, ".tmp-validation-tests");
const outputPath = join(outputDir, "routing-validation.cjs");
const capacityOutputPath = join(outputDir, "capacity.cjs");
const strategyOutputPath = join(outputDir, "optimization-strategy.cjs");

mkdirSync(outputDir, { recursive: true });

const source = readFileSync(sourcePath, "utf8").replace(
  "@/lib/optimization-strategy",
  "./optimization-strategy.cjs",
).replace(
  "@/lib/capacity",
  "./capacity.cjs",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
});
const strategyCompiled = ts.transpileModule(readFileSync(strategySourcePath, "utf8"), {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
});
const capacityCompiled = ts.transpileModule(readFileSync(capacitySourcePath, "utf8"), {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
});

writeFileSync(capacityOutputPath, capacityCompiled.outputText);
writeFileSync(strategyOutputPath, strategyCompiled.outputText);
writeFileSync(outputPath, compiled.outputText);

const require = createRequire(import.meta.url);
const { validateRoutingProblem } = require(outputPath);

const baseProblem = {
  id: "problem-test",
  name: "Test route",
  depot: { address: "Bologna" },
  vehicles: [
    { id: "vehicle-1", name: "Van 1", capacity: 800 },
    { id: "vehicle-2", name: "Van 2", capacity: 1200 },
  ],
  stops: [
    {
      id: "stop-1",
      name: "Rossi SRL",
      address: "Via Roma 45, Milano",
      demand: 120,
      timeWindow: { start: "08:00", end: "12:00" },
    },
    {
      id: "stop-2",
      name: "Bianchi Spa",
      address: "Corso Como 2, Milano",
      demand: 50,
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
  status: "ready",
};

const cases = [
  {
    name: "complete valid problem",
    mutate: (problem) => problem,
    ready: true,
  },
  {
    name: "missing depot",
    mutate: (problem) => ({ ...problem, depot: { address: "" } }),
    ready: false,
    code: "MISSING_DEPOT",
  },
  {
    name: "no vehicles",
    mutate: (problem) => ({ ...problem, vehicles: [] }),
    ready: false,
    code: "NO_VEHICLES",
  },
  {
    name: "no stops",
    mutate: (problem) => ({ ...problem, stops: [] }),
    ready: false,
    code: "NO_STOPS",
  },
  {
    name: "missing optimization strategy",
    mutate: (problem) => ({
      ...problem,
      optimizationStrategy: undefined,
      objective: undefined,
    }),
    ready: false,
    code: "MISSING_OPTIMIZATION_STRATEGY",
  },
  {
    name: "old objective migration",
    mutate: (problem) => ({
      ...problem,
      optimizationStrategy: undefined,
      objective: "minimize_time",
    }),
    ready: true,
  },
  {
    name: "Engine v2 balanced preset",
    mutate: (problem) => ({
      ...problem,
      optimizationStrategy: {
        mode: "preset",
        preset: "balanced",
        objectives: [
          { type: "balance_workload", enabled: true, priority: 1 },
          { type: "minimize_time", enabled: true, priority: 2 },
          { type: "minimize_distance", enabled: true, priority: 3 },
          { type: "minimize_vehicles", enabled: true, priority: 4 },
        ],
      },
    }),
    ready: true,
  },
  {
    name: "operating cost objective requires vehicle costs",
    mutate: (problem) => ({
      ...problem,
      optimizationStrategy: {
        mode: "advanced",
        objectives: [
          {
            type: "minimize_operating_cost",
            enabled: true,
            priority: 1,
            weight: 1,
          },
        ],
      },
    }),
    ready: false,
    code: "OPERATING_COST_DATA_REQUIRED",
  },
  {
    name: "operating cost objective with vehicle costs",
    mutate: (problem) => ({
      ...problem,
      vehicles: problem.vehicles.map((vehicle) => ({
        ...vehicle,
        operatingCost: {
          fixedCost: 40,
          costPerKm: 0.3,
          costPerHour: 20,
        },
      })),
      optimizationStrategy: {
        mode: "advanced",
        objectives: [
          {
            type: "minimize_operating_cost",
            enabled: true,
            priority: 1,
            weight: 1,
          },
        ],
      },
    }),
    ready: true,
  },
  {
    name: "invalid advanced weight total",
    mutate: (problem) => ({
      ...problem,
      optimizationStrategy: {
        mode: "advanced",
        objectives: [
          {
            type: "minimize_time",
            enabled: true,
            priority: 1,
            weight: 0.6,
          },
          {
            type: "minimize_distance",
            enabled: true,
            priority: 2,
            weight: 0.6,
          },
        ],
      },
    }),
    ready: false,
    code: "INVALID_OBJECTIVE_WEIGHT_TOTAL",
  },
  {
    name: "returnToDepot undefined",
    mutate: (problem) => ({ ...problem, returnToDepot: undefined }),
    ready: false,
    code: "MISSING_RETURN_TO_DEPOT",
  },
  {
    name: "demand with missing vehicle capacity",
    mutate: (problem) => ({
      ...problem,
      vehicles: problem.vehicles.map((vehicle) => ({
        id: vehicle.id,
        name: vehicle.name,
      })),
    }),
    ready: false,
    code: "INVALID_VEHICLE_CAPACITY",
  },
  {
    name: "total demand exceeds total vehicle capacity",
    mutate: (problem) => ({
      ...problem,
      vehicles: [{ id: "vehicle-1", name: "Van 1", capacity: 100 }],
    }),
    ready: false,
    code: "TOTAL_DEMAND_EXCEEDS_CAPACITY",
  },
  {
    name: "valid time window",
    mutate: (problem) => ({
      ...problem,
      stops: [
        {
          ...problem.stops[0],
          timeWindow: { start: "08:00", end: "12:00" },
        },
      ],
    }),
    ready: true,
    missingCode: "INVALID_TIME_WINDOW_ORDER",
  },
  {
    name: "invalid time window",
    mutate: (problem) => ({
      ...problem,
      stops: [
        {
          ...problem.stops[0],
          timeWindow: { start: "12:00", end: "08:00" },
        },
      ],
    }),
    ready: false,
    code: "INVALID_TIME_WINDOW_ORDER",
  },
  {
    name: "duplicate stop IDs",
    mutate: (problem) => ({
      ...problem,
      stops: [
        problem.stops[0],
        { ...problem.stops[1], id: problem.stops[0].id },
      ],
    }),
    ready: false,
    code: "DUPLICATE_STOP_ID",
  },
  {
    name: "duplicate vehicle IDs",
    mutate: (problem) => ({
      ...problem,
      vehicles: [
        problem.vehicles[0],
        { ...problem.vehicles[1], id: problem.vehicles[0].id },
      ],
    }),
    ready: false,
    code: "DUPLICATE_VEHICLE_ID",
  },
];

try {
  for (const testCase of cases) {
    const problem = testCase.mutate(structuredClone(baseProblem));
    const result = validateRoutingProblem(problem);
    const codes = result.issues.map((issue) => issue.code);

    assert.equal(result.ready, testCase.ready, testCase.name);

    if (testCase.code) {
      assert.ok(codes.includes(testCase.code), testCase.name);
    }

    if (testCase.missingCode) {
      assert.ok(!codes.includes(testCase.missingCode), testCase.name);
    }
  }

  console.log(`routing-validation: ${cases.length} tests passed`);
} finally {
  rmSync(outputDir, { force: true, recursive: true });
}
