"use client";

import { FormEvent, useState } from "react";
import { Minus, Plus } from "lucide-react";

import type { ConversationQuestion } from "@/lib/conversation-types";
import { useOptimizationStore } from "@/providers/optimization-provider";

export function NumberQuestion({ question }: { question: ConversationQuestion }) {
  const [value, setValue] = useState("3");
  const answerConversationQuestion = useOptimizationStore(
    (state) => state.answerConversationQuestion,
  );
  const numericValue = Number(value);
  const isValid =
    Number.isInteger(numericValue) && numericValue >= 1 && numericValue <= 20;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isValid) {
      return;
    }

    answerConversationQuestion(question, numericValue);
  }

  function step(delta: number) {
    const nextValue = Number.isFinite(numericValue) ? numericValue + delta : 1;
    setValue(String(Math.max(1, Math.min(20, nextValue))));
  }

  return (
    <form className="flex max-w-xs items-center gap-2" onSubmit={handleSubmit}>
      <button
        aria-label="Decrease"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-foreground transition-colors hover:bg-surface-container"
        onClick={() => step(-1)}
        type="button"
      >
        <Minus aria-hidden className="h-4 w-4" />
      </button>
      <input
        className="h-10 min-w-0 flex-1 rounded-md border border-border bg-surface px-3 text-center font-display text-sm font-medium text-foreground outline-none focus:border-primary-accent focus:ring-2 focus:ring-primary-accent/10"
        inputMode="numeric"
        max={20}
        min={1}
        onChange={(event) => setValue(event.target.value)}
        type="number"
        value={value}
      />
      <button
        aria-label="Increase"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-foreground transition-colors hover:bg-surface-container"
        onClick={() => step(1)}
        type="button"
      >
        <Plus aria-hidden className="h-4 w-4" />
      </button>
      <button
        className="h-10 rounded-md bg-foreground px-4 font-display text-sm font-medium text-card transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        disabled={!isValid}
        type="submit"
      >
        Confirm
      </button>
    </form>
  );
}
