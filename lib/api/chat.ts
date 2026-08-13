import type {
  ChatExtractRequest,
  ChatExtractResponse,
  RoutingExtraction,
} from "@/lib/api/chat-types";
import { getApiBaseUrl } from "@/lib/api/base-url";
import { handleAuthFailure } from "@/lib/api/auth";
import { persistenceHeaders } from "@/lib/api/persistence-context";

export class ChatApiError extends Error {
  constructor(message = "Chat extraction request failed.") {
    super(message);
    this.name = "ChatApiError";
  }
}

export async function sendRoutingMessage(
  request: ChatExtractRequest,
): Promise<RoutingExtraction> {
  const startedAt = performance.now();
  const traceEnabled = process.env.NEXT_PUBLIC_CONVERSATION_DEBUG === "true";
  const response = await fetch(`${getApiBaseUrl()}/chat/extract`, {
    credentials: "include",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(request.traceId
        ? { "X-RoutesPilot-Chat-Trace-Id": request.traceId }
        : {}),
      ...persistenceHeaders(),
    },
    body: JSON.stringify(request),
    cache: "no-store",
  });
  const latencyMs = Math.round(performance.now() - startedAt);

  if (traceEnabled) {
    console.info("[RoutesPilot Chat][Network]", {
      endpoint: "POST /api/v1/chat/extract",
      traceId: request.traceId,
      stateRevision: request.stateRevision,
      status: response.status,
      latencyMs,
    });
  }

  if (!response.ok) {
    handleAuthFailure(response);
    throw new ChatApiError();
  }

  const payload: unknown = await response.json();

  if (!isChatExtractResponse(payload)) {
    throw new ChatApiError("Chat extraction response was malformed.");
  }

  if (traceEnabled) {
    console.info("[RoutesPilot Chat][Backend Interpretation]", {
      traceId: payload.traceId,
      debug: payload.debug,
      extraction: payload.extraction,
    });
  }

  return payload.extraction;
}

function isChatExtractResponse(value: unknown): value is ChatExtractResponse {
  if (typeof value !== "object" || value === null || !("extraction" in value)) {
    return false;
  }

  const extraction = value.extraction;

  return (
    typeof extraction === "object" &&
    extraction !== null &&
    "problemPatch" in extraction &&
    "confidence" in extraction &&
    "ambiguities" in extraction
  );
}
