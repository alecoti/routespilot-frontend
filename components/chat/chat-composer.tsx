"use client";

import {
  ChangeEvent,
  FormEvent,
  KeyboardEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import { Loader2, Paperclip, Send } from "lucide-react";

import { sendRoutingMessage } from "@/lib/api/chat";
import { sendConversationTurn } from "@/lib/api/conversations";
import { saveOptimizationDraft } from "@/lib/api/history";
import { hasPersistenceContext } from "@/lib/api/persistence-context";
import { getNextQuestion } from "@/lib/conversation-engine";
import { validateRoutingProblem } from "@/lib/routing-validation";
import { traceRoutingDebug } from "@/lib/routing-debug";
import { mergeDeterministicRoutingFacts } from "@/lib/vehicle-text-extraction";
import {
  useOptimizationStore,
  useOptionalOptimizationStoreApi,
} from "@/providers/optimization-provider";

export function ChatComposer({
  isFileImporting = false,
  onFileSelected,
}: {
  isFileImporting?: boolean;
  onFileSelected?: (file: File) => void;
}) {
  const [message, setMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const storeApi = useOptionalOptimizationStoreApi();
  const isInterpretingMessage = useOptimizationStore(
    (state) => state.isInterpretingMessage,
  );
  const conversationRevision = useOptimizationStore(
    (state) => state.conversationRevision,
  );
  const conversationSessionId = useOptimizationStore(
    (state) => state.conversationSessionId,
  );
  const problem = useOptimizationStore((state) => state.problem);
  const optimizationId = useOptimizationStore((state) => state.optimizationId);
  const addAssistantConversationMessage = useOptimizationStore(
    (state) => state.addAssistantConversationMessage,
  );
  const addUserConversationMessage = useOptimizationStore(
    (state) => state.addUserConversationMessage,
  );
  const applyRoutingExtraction = useOptimizationStore(
    (state) => state.applyRoutingExtraction,
  );
  const setProblem = useOptimizationStore((state) => state.setProblem);
  const setConversationPending = useOptimizationStore(
    (state) => state.setConversationPending,
  );
  const currentQuestion = useMemo(() => getNextQuestion(problem), [problem]);
  const trimmedMessage = message.trim();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const missingHint = getComposerHint(currentQuestion?.message);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isInterpretingMessage || trimmedMessage.length === 0) {
      return;
    }

    const submittedMessage = trimmedMessage;
    const submittedProblem = problem;
    const submittedConversationSessionId = conversationSessionId;
    const traceId = createChatTraceId();
    const stateRevision = conversationRevision;
    traceRoutingDebug("CHAT_SUBMIT_START", {
      conversationId: submittedConversationSessionId,
      optimizationId,
      problem: submittedProblem,
      revision: stateRevision,
      traceId,
      extra: {
        currentQuestion: currentQuestion?.id ?? null,
        message: submittedMessage,
      },
    });

    addUserConversationMessage(submittedMessage, currentQuestion);
    setMessage("");
    window.requestAnimationFrame(() => textareaRef.current?.focus());

    try {
      setConversationPending(true);

      const request = {
        message: submittedMessage,
        problem: submittedProblem,
        validation: validateRoutingProblem(submittedProblem),
        currentQuestion,
        traceId,
        stateRevision,
      };
      const turnId = createChatTurnId();
      const conversationResponse = isUuid(conversationSessionId)
        ? await sendConversationTurn(conversationSessionId, {
            ...request,
            turnId,
          }).catch(() => null)
        : null;
      traceRoutingDebug("CHAT_BACKEND_RESPONSE", {
        conversationId:
          conversationResponse?.conversationId ?? submittedConversationSessionId,
        optimizationId,
        problem: storeApi?.getState().problem ?? submittedProblem,
        revision: storeApi?.getState().conversationRevision ?? stateRevision,
        traceId,
        extra: {
          assistantMessage: conversationResponse?.assistantMessage?.content ?? null,
          classification: conversationResponse?.classification ?? null,
          engine: conversationResponse?.debug?.engine ?? "legacy",
          hasExtraction: Boolean(conversationResponse?.extraction),
          turnId,
        },
      });

      if (!isCurrentConversation(storeApi, submittedConversationSessionId)) {
        traceStaleTurn({
          activeConversationSessionId: storeApi?.getState().conversationSessionId,
          requestedConversationSessionId: submittedConversationSessionId,
          traceId,
        });
        return;
      }

      if (conversationResponse?.problem) {
        setProblem(conversationResponse.problem, {
          conversationRevision: conversationResponse.stateRevisionAfter,
        });

        traceRoutingDebug("CHAT_AGENTIC_PROBLEM_SYNC", {
          conversationId:
            conversationResponse.conversationId ?? submittedConversationSessionId,
          optimizationId,
          problem: conversationResponse.problem,
          revision: conversationResponse.stateRevisionAfter,
          traceId,
          extra: {
            responseRevisionBefore: conversationResponse.stateRevisionBefore,
            stopCount: conversationResponse.problem.stops.length,
            vehicleCount: conversationResponse.problem.vehicles.length,
          },
        });
      }

      if (conversationResponse?.assistantMessage && !conversationResponse.extraction) {
        const syncedProblem = storeApi?.getState().problem ?? conversationResponse.problem;

        if (optimizationId && syncedProblem && hasPersistenceContext()) {
          traceRoutingDebug("CHAT_AGENTIC_DRAFT_AUTOSAVE_REQUEST", {
            conversationId: submittedConversationSessionId,
            optimizationId,
            problem: syncedProblem,
            revision: storeApi?.getState().conversationRevision,
            traceId,
          });
          void saveOptimizationDraft(optimizationId, syncedProblem).catch(() => {
            if (process.env.NEXT_PUBLIC_CONVERSATION_DEBUG === "true") {
              console.info(`[RoutesPilot Chat][${traceId}] Agentic draft autosave failed`);
            }
          });
        }

        addAssistantConversationMessage(conversationResponse.assistantMessage.content);
        return;
      }

      const extraction =
        conversationResponse?.extraction ?? (await sendRoutingMessage(request));
      const mergedExtraction = mergeDeterministicRoutingFacts(
        extraction,
        submittedMessage,
      );
      traceRoutingDebug("CHAT_EXTRACTION_READY", {
        conversationId: submittedConversationSessionId,
        extraction: mergedExtraction,
        optimizationId,
        problem: storeApi?.getState().problem ?? submittedProblem,
        revision: storeApi?.getState().conversationRevision ?? stateRevision,
        traceId,
        extra: {
          beforeStops: submittedProblem.stops.length,
          beforeVehicles: submittedProblem.vehicles.length,
        },
      });
      const latestRevision =
        storeApi?.getState().conversationRevision ?? stateRevision;
      const latestConversationSessionId =
        storeApi?.getState().conversationSessionId ??
        submittedConversationSessionId;

      if (
        latestRevision !== stateRevision ||
        latestConversationSessionId !== submittedConversationSessionId
      ) {
        if (process.env.NEXT_PUBLIC_CONVERSATION_DEBUG === "true") {
          console.info(`[RoutesPilot Chat][${traceId}] Stale response ignored`, {
            latestConversationSessionId,
            latestRevision,
            responseConversationSessionId: submittedConversationSessionId,
            responseRevision: stateRevision,
          });
        }

        traceRoutingDebug("CHAT_RESPONSE_SKIPPED_STALE", {
          conversationId: latestConversationSessionId,
          extraction: mergedExtraction,
          optimizationId,
          problem: storeApi?.getState().problem,
          revision: latestRevision,
          traceId,
          extra: {
            responseConversationSessionId: submittedConversationSessionId,
            responseRevision: stateRevision,
          },
        });
        return;
      }

      if (process.env.NEXT_PUBLIC_CONVERSATION_DEBUG === "true") {
        console.groupCollapsed(`[RoutesPilot Chat][${traceId}] Turn`);
        console.info("0. Active workspace", {
          conversationId: submittedConversationSessionId,
          optimizationId,
          problemId: submittedProblem.id,
          revision: stateRevision,
          stopCount: submittedProblem.stops.length,
          vehicleCount: submittedProblem.vehicles.length,
        });
        console.info("1. User message", submittedMessage);
        console.info("2. Request state revision", stateRevision);
        console.info("3. Current question", currentQuestion);
        console.info("4. Backend extraction", extraction);
        console.info("5. Merged extraction", mergedExtraction);
        console.groupEnd();
      }

      applyRoutingExtraction(mergedExtraction, {
        traceId,
        stateRevision,
      });

      const updatedProblem = storeApi?.getState().problem;

      if (
        process.env.NEXT_PUBLIC_CONVERSATION_DEBUG === "true" &&
        updatedProblem
      ) {
        console.info(`[RoutesPilot Chat][${traceId}] FRONTEND_CANONICAL_PROBLEM`, {
          capacityDimensions: updatedProblem.capacityDimensions?.map(
            (dimension) => dimension.key,
          ),
          conversationId: submittedConversationSessionId,
          depot: updatedProblem.depot?.address,
          optimizationId,
          problemId: updatedProblem.id,
          strategy: {
            mode: updatedProblem.optimizationStrategy?.mode,
            objectives: updatedProblem.optimizationStrategy?.objectives.map(
              (objective) => objective.type,
            ),
            preset: updatedProblem.optimizationStrategy?.preset,
          },
          stopCount: updatedProblem.stops.length,
          vehicles: updatedProblem.vehicles.map((vehicle) => vehicle.name),
        });
      }

      if (optimizationId && updatedProblem && hasPersistenceContext()) {
        traceRoutingDebug("CHAT_DRAFT_AUTOSAVE_REQUEST", {
          conversationId: submittedConversationSessionId,
          optimizationId,
          problem: updatedProblem,
          revision: storeApi?.getState().conversationRevision,
          traceId,
        });
        void saveOptimizationDraft(optimizationId, updatedProblem).catch(() => {
          if (process.env.NEXT_PUBLIC_CONVERSATION_DEBUG === "true") {
            console.info(`[RoutesPilot Chat][${traceId}] Draft autosave failed`);
          }
        });
      }

      if (conversationResponse?.assistantMessage) {
        addAssistantConversationMessage(conversationResponse.assistantMessage.content);
      }
    } catch {
      if (isCurrentConversation(storeApi, submittedConversationSessionId)) {
        addAssistantConversationMessage(
          "I couldn't interpret that message. Could you try phrasing it differently?",
        );
      }
    } finally {
      if (isCurrentConversation(storeApi, submittedConversationSessionId)) {
        setConversationPending(false);
        window.requestAnimationFrame(() => textareaRef.current?.focus());
      }
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }

    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }

  return (
    <form
      className="w-full max-w-3xl"
      onSubmit={handleSubmit}
    >
      {missingHint ? (
        <p className="mb-2 px-2 text-xs font-medium text-muted-foreground">
          {missingHint}
        </p>
      ) : null}
      <div className="flex items-end gap-2 rounded-2xl border border-border bg-card p-2 shadow-[0_8px_24px_rgba(0,0,0,0.06)] transition-colors focus-within:border-primary-accent focus-within:ring-2 focus-within:ring-primary-accent/10">
        <button
          aria-label="Attach deliveries file"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-surface-container hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          disabled={isInterpretingMessage || isFileImporting}
          onClick={() => fileInputRef.current?.click()}
          title="Attach deliveries file"
          type="button"
        >
          <Paperclip aria-hidden className="h-5 w-5" />
        </button>
        <input
          accept=".csv,.xlsx"
          className="hidden"
          onChange={(event) => {
            handleFileChange(event, onFileSelected);
          }}
          ref={fileInputRef}
          type="file"
        />
        <textarea
          className="max-h-48 min-h-10 flex-1 resize-none overflow-y-auto bg-transparent py-2 text-[15px] leading-6 text-foreground outline-none placeholder:text-muted-foreground/70 disabled:cursor-not-allowed disabled:text-muted-foreground"
          disabled={isInterpretingMessage}
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={getComposerPlaceholder()}
          ref={textareaRef}
          rows={1}
          value={message}
        />
        <button
          aria-label={isInterpretingMessage ? "Sending message" : "Send message"}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-foreground text-card transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={isInterpretingMessage || trimmedMessage.length === 0}
          type="submit"
        >
          {isInterpretingMessage ? (
            <Loader2 aria-hidden className="h-5 w-5 animate-spin" />
          ) : (
            <Send aria-hidden className="h-5 w-5" />
          )}
        </button>
      </div>
      <p className="mt-2 px-2 text-xs text-muted-foreground">
        Attach CSV or XLSX. Press Enter to send, Shift+Enter for a new line.
      </p>
    </form>
  );
}

function createChatTraceId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `chat_${crypto.randomUUID()}`;
  }

  return `chat_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function createChatTurnId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `turn_${crypto.randomUUID()}`;
  }

  return `turn_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function isCurrentConversation(
  storeApi: ReturnType<typeof useOptionalOptimizationStoreApi>,
  conversationSessionId: string,
) {
  return (
    !storeApi || storeApi.getState().conversationSessionId === conversationSessionId
  );
}

function traceStaleTurn({
  activeConversationSessionId,
  requestedConversationSessionId,
  traceId,
}: {
  activeConversationSessionId?: string;
  requestedConversationSessionId: string;
  traceId: string;
}) {
  if (process.env.NEXT_PUBLIC_CONVERSATION_DEBUG !== "true") {
    return;
  }

  console.info(`[RoutesPilot Chat][${traceId}] Stale turn ignored`, {
    activeConversationSessionId,
    requestedConversationSessionId,
  });
}

function handleFileChange(
  event: ChangeEvent<HTMLInputElement>,
  onFileSelected?: (file: File) => void,
) {
  const file = event.target.files?.[0];

  if (file) {
    onFileSelected?.(file);
  }

  event.target.value = "";
}

function getComposerPlaceholder() {
  return "Message RoutesPilot...";
}

function getComposerHint(questionMessage?: string) {
  if (!questionMessage) {
    return null;
  }

  return `Needed: ${questionMessage}`;
}
