"use client";

import type { ConversationQuestion } from "@/lib/conversation-types";
import { useOptimizationStore } from "@/providers/optimization-provider";

export function BooleanQuestion({
  question,
}: {
  question: ConversationQuestion;
}) {
  const answerConversationQuestion = useOptimizationStore(
    (state) => state.answerConversationQuestion,
  );
  const options = question.options ?? [
    { label: "Yes", value: "true" },
    { label: "No", value: "false" },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          className="rounded-full border border-border bg-surface px-4 py-2 font-display text-sm font-medium text-foreground transition-colors hover:bg-surface-container"
          key={option.value}
          onClick={() =>
            answerConversationQuestion(question, option.value === "true")
          }
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
