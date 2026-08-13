import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import ts from "typescript";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const sourcePath = join(root, "lib", "optimization-strategy.ts");
const outputDir = join(root, ".tmp-strategy-tests");
const outputPath = join(outputDir, "optimization-strategy.cjs");

mkdirSync(outputDir, { recursive: true });

const compiled = ts.transpileModule(readFileSync(sourcePath, "utf8"), {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
});

writeFileSync(outputPath, compiled.outputText);

const require = createRequire(import.meta.url);
const {
  createAdvancedStrategy,
  createPresetStrategy,
  describeOptimizationStrategy,
  getCurrentSolverObjective,
  normalizeAdvancedWeights,
  normalizePriorityStrategy,
  strategyFromLegacyObjective,
  validateOptimizationStrategy,
} = require(outputPath);

try {
  const fastest = createPresetStrategy("fastest");
  assert.equal(fastest.mode, "preset");
  assert.deepEqual(
    fastest.objectives.map((objective) => objective.type),
    ["minimize_time", "minimize_distance"],
  );
  assert.equal(getCurrentSolverObjective(fastest), "minimize_time");

  const normalizedPriority = normalizePriorityStrategy({
    mode: "priority",
    objectives: [
      { type: "minimize_distance", enabled: true, priority: 20 },
      { type: "minimize_time", enabled: true, priority: 10 },
    ],
  });
  assert.deepEqual(
    normalizedPriority.objectives.map((objective) => objective.priority),
    [2, 1],
  );

  const duplicatePriorityIssues = validateOptimizationStrategy({
    mode: "priority",
    objectives: [
      { type: "minimize_time", enabled: true, priority: 1 },
      { type: "minimize_distance", enabled: true, priority: 1 },
    ],
  });
  assert.ok(
    duplicatePriorityIssues.some(
      (issue) => issue.code === "DUPLICATE_OBJECTIVE_PRIORITY",
    ),
  );

  const normalizedWeights = normalizeAdvancedWeights({
    mode: "advanced",
    objectives: [
      { type: "minimize_time", enabled: true, priority: 1, weight: 0.8 },
      { type: "minimize_distance", enabled: true, priority: 2, weight: 0.4 },
    ],
  });
  assert.equal(
    normalizedWeights.objectives.reduce(
      (sum, objective) => sum + objective.weight,
      0,
    ),
    1,
  );

  const invalidWeightIssues = validateOptimizationStrategy({
    mode: "advanced",
    objectives: [
      { type: "minimize_time", enabled: true, priority: 1, weight: 0.6 },
      { type: "minimize_distance", enabled: true, priority: 2, weight: 0.6 },
    ],
  });
  assert.ok(
    invalidWeightIssues.some(
      (issue) => issue.code === "INVALID_OBJECTIVE_WEIGHT_TOTAL",
    ),
  );

  assert.equal(strategyFromLegacyObjective("minimize_distance").preset, "shortest");

  const balanced = createPresetStrategy("balanced");
  assert.equal(getCurrentSolverObjective(balanced), "balance_workload");
  assert.deepEqual(validateOptimizationStrategy(balanced), []);

  const costEfficient = createPresetStrategy("cost_efficient");
  assert.equal(getCurrentSolverObjective(costEfficient), "minimize_operating_cost");

  const operatingCost = {
    mode: "advanced",
    objectives: [
      {
        type: "minimize_operating_cost",
        enabled: true,
        priority: 1,
        weight: 1,
      },
    ],
  };
  assert.deepEqual(validateOptimizationStrategy(operatingCost), []);
  assert.equal(getCurrentSolverObjective(operatingCost), "minimize_operating_cost");

  const advanced = createAdvancedStrategy({
    minimize_operating_cost: 0.3,
    minimize_time: 0.4,
    minimize_vehicles: 0.1,
    minimize_distance: 0.2,
  });
  assert.equal(describeOptimizationStrategy(advanced).label, "Custom weights");

  console.log("optimization-strategy: 11 tests passed");
} finally {
  rmSync(outputDir, { force: true, recursive: true });
}
