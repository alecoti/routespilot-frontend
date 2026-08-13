import type {
  ChatExtractRequest,
  RoutingExtraction,
} from "@/lib/api/chat-types";
import { getApiBaseUrl } from "@/lib/api/base-url";
import { handleAuthFailure } from "@/lib/api/auth";
import {
  hasPersistenceContext,
  persistenceHeaders,
} from "@/lib/api/persistence-context";
import type { ConversationMessage } from "@/lib/conversation-types";
import type { RoutingProblem } from "@/lib/types";

const ACTIVE_CONVERSATION_STORAGE_KEY = "routespilot.activeConversationId";

export class ConversationApiError extends Error {
  constructor(message = "Conversation request failed.") {
    super(message);
    this.name = "ConversationApiError";
  }
}

export type ConversationHydratePayload = {
  session: { id: string; optimizationId?: string };
  messages: ConversationMessage[];
  problem?: RoutingProblem;
  revision?: number;
  context?: Record<string, unknown>;
};

export type ConversationTurnPayload = {
  conversationId: string;
  turnId: string;
  traceId: string;
  assistantMessage?: ConversationMessage;
  extraction?: RoutingExtraction;
  classification?: {
    intents: string[];
  };
  problem?: RoutingProblem;
  stateRevisionBefore?: number;
  stateRevisionAfter?: number;
  context?: Record<string, unknown>;
  debug?: Record<string, unknown>;
};

export async function ensureConversationSession({
  initialAssistantMessage,
  problem,
}: {
  initialAssistantMessage?: string;
  problem: RoutingProblem;
}): Promise<ConversationHydratePayload | null> {
  if (!hasPersistenceContext()) {
    return null;
  }

  const existingId = getStoredConversationId();

  if (existingId) {
    try {
      return await hydrateConversation(existingId);
    } catch {
      clearStoredConversationId();
    }
  }

  const response = await fetch(`${getApiBaseUrl()}/conversations`, {
    credentials: "include",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...persistenceHeaders(),
    },
    body: JSON.stringify({
      problem,
      draftId: problem.id,
      initialAssistantMessage,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    handleAuthFailure(response);
    return null;
  }

  const payload = normalizeHydratePayload(await response.json());

  storeConversationId(payload.session.id);

  return payload;
}

export async function createConversationSession({
  initialAssistantMessage,
  problem,
}: {
  initialAssistantMessage?: string;
  problem: RoutingProblem;
}): Promise<ConversationHydratePayload | null> {
  if (!hasPersistenceContext()) {
    return null;
  }

  const response = await fetch(`${getApiBaseUrl()}/conversations`, {
    credentials: "include",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...persistenceHeaders(),
    },
    body: JSON.stringify({
      problem,
      draftId: problem.id,
      initialAssistantMessage,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    handleAuthFailure(response);
    return null;
  }

  const payload = normalizeHydratePayload(await response.json());

  storeConversationId(payload.session.id);

  return payload;
}

export async function hydrateConversation(
  conversationId: string,
): Promise<ConversationHydratePayload> {
  const response = await fetch(`${getApiBaseUrl()}/conversations/${conversationId}`, {
    credentials: "include",
    method: "GET",
    headers: persistenceHeaders(),
    cache: "no-store",
  });

  if (!response.ok) {
    handleAuthFailure(response);
    throw new ConversationApiError();
  }

  return normalizeHydratePayload(await response.json());
}

export async function sendConversationTurn(
  conversationId: string,
  request: ChatExtractRequest & { turnId: string },
): Promise<ConversationTurnPayload> {
  const response = await fetch(
    `${getApiBaseUrl()}/conversations/${conversationId}/turns`,
    {
      credentials: "include",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(request.traceId
          ? { "X-RoutesPilot-Chat-Trace-Id": request.traceId }
          : {}),
        ...persistenceHeaders({ idempotencyKey: request.turnId }),
      },
      body: JSON.stringify(request),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    handleAuthFailure(response);
    throw new ConversationApiError();
  }

  return normalizeTurnPayload(await response.json());
}

export function getStoredConversationId() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(ACTIVE_CONVERSATION_STORAGE_KEY);
}

export function storeConversationId(conversationId: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(ACTIVE_CONVERSATION_STORAGE_KEY, conversationId);
}

export function clearStoredConversationId() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(ACTIVE_CONVERSATION_STORAGE_KEY);
}

function normalizeHydratePayload(payload: unknown): ConversationHydratePayload {
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("session" in payload) ||
    !("messages" in payload)
  ) {
    throw new ConversationApiError("Conversation hydrate response was malformed.");
  }

  const session = payload.session as { id?: unknown; optimizationId?: unknown };
  const messages = Array.isArray(payload.messages) ? payload.messages : [];

  if (typeof session.id !== "string") {
    throw new ConversationApiError("Conversation session was malformed.");
  }

  return {
    session: {
      id: session.id,
      optimizationId:
        typeof session.optimizationId === "string"
          ? session.optimizationId
          : undefined,
    },
    messages: messages
      .map(normalizeMessage)
      .filter((message): message is ConversationMessage => Boolean(message)),
    problem: extractProblem(payload),
    revision: extractRevision(payload),
    context:
      "context" in payload && typeof payload.context === "object"
        ? (payload.context as Record<string, unknown>)
        : undefined,
  };
}

function extractProblem(payload: object): RoutingProblem | undefined {
  if (!("context" in payload) || typeof payload.context !== "object" || payload.context === null) {
    return undefined;
  }

  const context = payload.context as Record<string, unknown>;

  return typeof context.currentProblem === "object" && context.currentProblem !== null
    ? (context.currentProblem as RoutingProblem)
    : undefined;
}

function normalizeTurnPayload(payload: unknown): ConversationTurnPayload {
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("conversationId" in payload) ||
    !("turnId" in payload) ||
    !("traceId" in payload)
  ) {
    throw new ConversationApiError("Conversation turn response was malformed.");
  }

  const value = payload as Record<string, unknown>;

  return {
    conversationId: String(value.conversationId),
    turnId: String(value.turnId),
    traceId: String(value.traceId),
    assistantMessage: normalizeMessage(value.assistantMessage),
    extraction: value.extraction as RoutingExtraction | undefined,
    classification: value.classification as { intents: string[] } | undefined,
    problem: extractProblem(value),
    stateRevisionBefore:
      typeof value.stateRevisionBefore === "number"
        ? value.stateRevisionBefore
        : undefined,
    stateRevisionAfter:
      typeof value.stateRevisionAfter === "number"
        ? value.stateRevisionAfter
        : undefined,
    context:
      typeof value.context === "object" && value.context !== null
        ? (value.context as Record<string, unknown>)
        : undefined,
    debug: value.debug as Record<string, unknown> | undefined,
  };
}

function extractRevision(payload: object): number | undefined {
  if (!("context" in payload) || typeof payload.context !== "object" || payload.context === null) {
    return undefined;
  }

  const context = payload.context as Record<string, unknown>;
  return typeof context.lastStateRevision === "number"
    ? context.lastStateRevision
    : undefined;
}

function normalizeMessage(value: unknown): ConversationMessage | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const message = value as Record<string, unknown>;

  if (
    typeof message.id !== "string" ||
    typeof message.role !== "string" ||
    typeof message.content !== "string"
  ) {
    return undefined;
  }

  if (message.role !== "assistant" && message.role !== "user") {
    return undefined;
  }

  return {
    id: message.id,
    role: message.role,
    content: message.content,
  };
}
