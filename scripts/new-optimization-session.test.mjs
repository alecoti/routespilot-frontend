import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

const newOptimizationLink = readFileSync(
  join(root, "components", "app-shell", "new-optimization-link.tsx"),
  "utf8",
);
const optimizationStore = readFileSync(
  join(root, "stores", "optimization-store.ts"),
  "utf8",
);
const optimizationInitializer = readFileSync(
  join(root, "components", "settings", "optimization-initializer.tsx"),
  "utf8",
);
const optimizeChat = readFileSync(
  join(root, "components", "chat", "optimize-chat.tsx"),
  "utf8",
);

assert.match(
  newOptimizationLink,
  /clearStoredConversationId/,
  "New Optimization must clear the active persisted conversation id before bootstrapping.",
);
assert.match(
  newOptimizationLink,
  /createConversationSession/,
  "New Optimization must create a backend conversation instead of hydrating the old one.",
);
assert.match(
  newOptimizationLink,
  /startNewOptimization/,
  "New Optimization must reset the full optimization store atomically.",
);
assert.doesNotMatch(
  newOptimizationLink,
  /getState\(\)\.setProblem/,
  "New Optimization must not only replace the problem inside the existing session.",
);

assert.match(
  optimizationStore,
  /startNewOptimization: \(payload\) =>\s+set\(\(\) => \{\s+const nextState = createDefaultOptimizationState/s,
  "startNewOptimization must rebuild the full default optimization state.",
);
assert.match(
  optimizationStore,
  /importedFile: null/,
  "The fresh optimization state must clear imported file state.",
);
assert.match(
  optimizationStore,
  /result: null/,
  "The fresh optimization state must clear previous optimization results.",
);
assert.match(
  optimizationStore,
  /routeGeometries: \[\]/,
  "The fresh optimization state must clear previous route geometries.",
);
assert.match(
  optimizationInitializer,
  /PENDING_INITIALIZED_CONVERSATION_KEY/,
  "One-shot bootstrap must support full conversation payloads.",
);
assert.match(
  optimizeChat,
  /requestedConversationRevision/,
  "Conversation hydration must capture the request revision.",
);
assert.match(
  optimizeChat,
  /activeConversationRevision !== requestedConversationRevision/,
  "Late conversation hydration must not overwrite a locally changed draft.",
);
assert.match(
  optimizeChat,
  /const activeProblem = storeApi\?\.getState\(\)\.problem \?\? problem/,
  "CSV import must use the latest canonical problem, not a stale React closure.",
);

console.info("new-optimization-session: reset contract tests passed");
