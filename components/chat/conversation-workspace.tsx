"use client";

import { useMemo } from "react";

import { deriveConversationAction } from "@/lib/conversation-engine";
import { formatOptimizationStrategy } from "@/lib/formatters";
import { formatLocationAddress } from "@/lib/locations";
import {
  formatCapacityValue,
  getCapacityDimensions,
  vehicleCapacityValue,
} from "@/lib/capacity";
import type { RoutingProblem } from "@/lib/types";
import { useOptimizationStore } from "@/providers/optimization-provider";
import {
  AssistantMessage,
  ReviewRouteButton,
  UserMessage,
} from "@/components/chat/chat-message";
import { QuestionRenderer } from "@/components/chat/questions/question-renderer";

export function ConversationWorkspace() {
  const isInterpretingMessage = useOptimizationStore(
    (state) => state.isInterpretingMessage,
  );
  const messages = useOptimizationStore((state) => state.messages);
  const problem = useOptimizationStore((state) => state.problem);
  const conversationAction = useMemo(
    () => deriveConversationAction(problem),
    [problem],
  );
  const currentQuestion = conversationAction.question;
  const lastMessage = messages.at(-1);
  const shouldSuppressAutomaticQuestion =
    Boolean(currentQuestion) && lastMessage?.role === "assistant";

  return (
    <>
      {messages.map((message) =>
        message.role === "user" ? (
          <UserMessage key={message.id}>{message.content}</UserMessage>
        ) : (
          <AssistantMessage key={message.id}>
            <p className="whitespace-pre-line">{message.content}</p>
          </AssistantMessage>
        ),
      )}

      {isInterpretingMessage ? (
        <AssistantMessage>
          <TypingIndicator />
        </AssistantMessage>
      ) : currentQuestion && !shouldSuppressAutomaticQuestion ? (
        <AssistantMessage>
          <p>{currentQuestion.message}</p>
          <QuestionRenderer question={currentQuestion} />
        </AssistantMessage>
      ) : shouldSuppressAutomaticQuestion ? null : conversationAction.type !==
        "PROCEED_TO_REVIEW" ? (
        <AssistantMessage>
          <p>{conversationAction.message}</p>
        </AssistantMessage>
      ) : (
        <AssistantMessage>
          <p>The route problem is ready for preview.</p>
          <ReadySummary problem={problem} />
          <ReviewRouteButton />
        </AssistantMessage>
      )}

      {!conversationAction.readiness.readyForOptimization &&
      conversationAction.readiness.warnings.length > 0 ? (
        <AssistantMessage>
          <p>{conversationAction.readiness.warnings[0]}</p>
        </AssistantMessage>
      ) : null}
    </>
  );
}

function TypingIndicator() {
  return (
    <div
      aria-label="RoutesPilot is updating the route plan"
      className="flex items-center gap-3 text-muted-foreground"
      role="status"
    >
      <span className="font-display text-sm">RoutesPilot is working</span>
      <span className="flex items-center gap-1" aria-hidden>
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.2s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.1s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" />
      </span>
    </div>
  );
}

function ReadySummary({ problem }: { problem: RoutingProblem }) {
  const timeWindowCount = problem.stops.filter((stop) => stop.timeWindow).length;
  const capacityDimensions = getCapacityDimensions(problem);
  const capacityVehicleLines = problem.vehicles
    .map((vehicle) => {
      const values = capacityDimensions
        .map((dimension) =>
          formatCapacityValue(
            vehicleCapacityValue(vehicle, dimension.key),
            dimension,
          ),
        )
        .filter(Boolean);

      return values.length > 0 ? `${vehicle.name}: ${values.join(" | ")}` : "";
    })
    .filter(Boolean);

  return (
    <div className="grid max-w-xl grid-cols-1 gap-3 rounded-lg border border-border bg-surface-low p-4 text-sm leading-6 text-muted-foreground sm:grid-cols-2">
      <SummaryItem label="Stops" value={String(problem.stops.length)} />
      <SummaryItem label="Vehicles" value={String(problem.vehicles.length)} />
      <SummaryItem label="Depot" value={formatLocationAddress(problem.depot)} />
      <SummaryItem
        label="Return"
        value={problem.returnToDepot ? "Return to depot" : "Finish at last stop"}
      />
      <SummaryItem
        label="Optimization"
        value={formatOptimizationStrategy(
          problem.optimizationStrategy,
          problem.objective,
        )}
      />
      <SummaryItem label="Time windows" value={String(timeWindowCount)} />
      {capacityVehicleLines.length > 0 ? (
        <div className="sm:col-span-2">
          <span className="font-display text-xs font-semibold uppercase text-muted-foreground">
            Capacities
          </span>
          <p className="mt-1 text-foreground">
            {capacityVehicleLines.join(" | ")}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="font-display text-xs font-semibold uppercase text-muted-foreground">
        {label}
      </span>
      <p className="mt-1 text-foreground">{value}</p>
    </div>
  );
}
