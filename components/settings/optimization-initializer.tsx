"use client";

import { useEffect } from "react";

import type { RoutingProblem } from "@/lib/types";
import { useOptimizationStore } from "@/providers/optimization-provider";

export const PENDING_INITIALIZED_PROBLEM_KEY =
  "routespilot.pendingInitializedProblem";
export const PENDING_INITIALIZED_CONVERSATION_KEY =
  "routespilot.pendingInitializedConversation";

export function OptimizationInitializer() {
  const setProblem = useOptimizationStore((state) => state.setProblem);
  const startNewOptimization = useOptimizationStore(
    (state) => state.startNewOptimization,
  );

  useEffect(() => {
    const rawConversation = window.sessionStorage.getItem(
      PENDING_INITIALIZED_CONVERSATION_KEY,
    );

    if (rawConversation) {
      window.sessionStorage.removeItem(PENDING_INITIALIZED_CONVERSATION_KEY);
      window.sessionStorage.removeItem(PENDING_INITIALIZED_PROBLEM_KEY);

      try {
        startNewOptimization(JSON.parse(rawConversation));
        return;
      } catch {
        // Fall back to the legacy problem bootstrap below.
      }
    }

    const rawProblem = window.sessionStorage.getItem(
      PENDING_INITIALIZED_PROBLEM_KEY,
    );

    if (!rawProblem) {
      return;
    }

    window.sessionStorage.removeItem(PENDING_INITIALIZED_PROBLEM_KEY);

    try {
      setProblem(JSON.parse(rawProblem) as RoutingProblem);
    } catch {
      // Ignore invalid one-shot bootstrap data and keep the local draft.
    }
  }, [setProblem, startNewOptimization]);

  return null;
}
