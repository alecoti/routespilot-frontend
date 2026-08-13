import { assessConversationReadiness } from "@/lib/conversation-readiness";
import type {
  ConversationAction,
  ConversationPhase,
  ConversationPlanningState,
  ImportedFileState,
} from "@/lib/conversation-types";
import type { RoutingProblem } from "@/lib/types";

export function createConversationPlanningState({
  importedFile = null,
  lastAction = null,
  problem,
  revision = 0,
  sessionId,
}: {
  importedFile?: ImportedFileState | null;
  lastAction?: ConversationAction | null;
  problem: RoutingProblem;
  revision?: number;
  sessionId: string;
}): ConversationPlanningState {
  const readiness = assessConversationReadiness(problem);

  return {
    sessionId,
    revision,
    phase: deriveConversationPhase(problem, readiness.readyForReview),
    pendingConfirmation: null,
    unresolvedAmbiguities: readiness.ambiguities,
    importedFile,
    readiness,
    currentFocus: lastAction?.question?.id ?? null,
    lastAction,
  };
}

function deriveConversationPhase(
  problem: RoutingProblem,
  readyForReview: boolean,
): ConversationPhase {
  if (problem.status === "completed") {
    return "result_available";
  }

  if (readyForReview) {
    return "ready_for_review";
  }

  if (problem.stops.length === 0 && problem.vehicles.length === 0 && !problem.depot) {
    return "empty";
  }

  return "collecting";
}
