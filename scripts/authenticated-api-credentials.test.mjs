import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

const checks = [
  {
    file: "lib/api/organization-config.ts",
    snippets: [
      "locations/templates?include_archived=${includeArchived}",
      "vehicles/templates?include_archived=${includeArchived}",
    ],
  },
  {
    file: "lib/api/history.ts",
    snippets: [
      "optimizations/${optimizationId}/draft",
      "optimizations/${optimizationId}/duplicate",
      "optimizations/${optimizationId}/exports",
      "optimizations/${optimizationId}/${action}",
    ],
  },
  {
    file: "lib/api/conversations.ts",
    snippets: ["conversations/${conversationId}/turns"],
  },
];

for (const check of checks) {
  const source = readFileSync(join(root, check.file), "utf8");

  for (const snippet of check.snippets) {
    const index = source.indexOf(snippet);
    assert.notEqual(index, -1, `${snippet} not found in ${check.file}`);

    const fetchBlock = source.slice(index, index + 500);
    assert.match(
      fetchBlock,
      /credentials:\s*"include"/,
      `${snippet} must include auth cookies`,
    );
  }
}

console.log("authenticated-api-credentials: protected fetches include cookies");
