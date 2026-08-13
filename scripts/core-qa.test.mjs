import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import ts from "typescript";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const sourcePath = join(root, "lib", "optimization-invalidation.ts");
const outputDir = join(root, ".tmp", "core-qa-tests");
const outputPath = join(outputDir, "optimization-invalidation.cjs");

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
  clearOptimizationArtifacts,
  patchInvalidatesOptimization,
} = require(outputPath);

try {
  for (const key of [
    "depot",
    "id",
    "objective",
    "optimizationStrategy",
    "returnToDepot",
    "stops",
    "vehicles",
  ]) {
    assert.equal(
      patchInvalidatesOptimization({ [key]: "changed" }),
      true,
      `${key} must invalidate stale optimization output`,
    );
  }

  assert.equal(patchInvalidatesOptimization({ status: "solving" }), false);
  assert.equal(patchInvalidatesOptimization({ name: "Renamed plan" }), false);

  assert.deepEqual(clearOptimizationArtifacts(), {
    comparisonError: null,
    comparisonPlans: [],
    comparisonStatus: "idle",
    recommendedComparisonPlanId: null,
    diagnostics: null,
    optimizationError: null,
    optimizationId: null,
    optimizationStatus: "idle",
    result: null,
    routeGeometries: [],
    routeGeometryError: null,
  });

  console.log("core-qa: stale optimization invalidation tests passed");
} finally {
  rmSync(outputDir, { force: true, recursive: true });
}
