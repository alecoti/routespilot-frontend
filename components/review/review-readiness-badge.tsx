"use client";

import { StatusBadge } from "@/components/ui/status-badge";
import { assessConversationReadiness } from "@/lib/conversation-readiness";
import { useOptimizationStore } from "@/providers/optimization-provider";

export function ReviewReadinessBadge() {
  const problem = useOptimizationStore((state) => state.problem);
  const readiness = assessConversationReadiness(problem);

  return readiness.readyForOptimization ? (
    <StatusBadge icon>Problem complete</StatusBadge>
  ) : (
    <StatusBadge className="border-amber-300 bg-amber-100 text-amber-800">
      Needs details
    </StatusBadge>
  );
}
