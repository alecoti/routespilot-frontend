import { getApiBaseUrl } from "@/lib/api/base-url";
import { handleAuthFailure } from "@/lib/api/auth";
import {
  captureAttribution,
  getStoredAttributionContext,
} from "@/lib/analytics";

export type TrialPayload = {
  messages?: Array<{ role: "user" | "assistant"; content: string }>;
  insights?: Array<{ type: string; label: string }>;
  lastUpload?: TrialAttachment;
};

export type TrialAttachment = {
  id: string;
  fileName: string;
  mimeType?: string | null;
  sizeBytes: number;
  status: string;
  inspection?: {
    rowCount: number;
    columns: string[];
    previewRows?: Record<string, string>[];
  };
};

export type TrialCurrent = {
  trialId: string;
  status: string;
  authRequired: boolean;
  payload: TrialPayload;
  attachments: TrialAttachment[];
};

export type TrialMessageResponse = {
  trialId: string;
  status: string;
  assistantMessage: string;
  authRequired: boolean;
  payload: TrialPayload;
  remainingMessages: number;
};

export type TrialUploadResponse = {
  trialId: string;
  status: string;
  attachment: TrialAttachment;
  assistantMessage: string;
  authRequired: boolean;
  payload: TrialPayload;
};

export type TrialConvertResponse = {
  trialId: string;
  conversationId: string;
  planningSessionId: string;
  optimizationId: string;
  alreadyConverted: boolean;
};

export class TrialApiError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "TrialApiError";
    this.code = code;
  }
}

export async function startTrialSession(): Promise<{ trialId: string }> {
  const response = await fetch(`${getApiBaseUrl()}/trial-sessions`, {
    body: JSON.stringify({
      initialSource: "landing",
      attributionContext: attributionContext(),
    }),
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    method: "POST",
    cache: "no-store",
  });

  if (!response.ok) {
    throw await trialErrorFromResponse(response);
  }

  return response.json();
}

export async function fetchCurrentTrial(): Promise<TrialCurrent> {
  const response = await fetch(`${getApiBaseUrl()}/trial-sessions/current`, {
    credentials: "include",
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw await trialErrorFromResponse(response);
  }

  return response.json();
}

export async function sendTrialMessage(
  message: string,
): Promise<TrialMessageResponse> {
  const response = await fetch(`${getApiBaseUrl()}/trial-sessions/message`, {
    body: JSON.stringify({ message }),
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    method: "POST",
    cache: "no-store",
  });

  if (!response.ok) {
    throw await trialErrorFromResponse(response);
  }

  return response.json();
}

export async function uploadTrialFile(file: File): Promise<TrialUploadResponse> {
  const contentBase64 = await fileToBase64(file);
  const response = await fetch(`${getApiBaseUrl()}/trial-sessions/upload`, {
    body: JSON.stringify({
      fileName: file.name,
      mimeType: file.type || null,
      size: file.size,
      contentBase64,
    }),
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    method: "POST",
    cache: "no-store",
  });

  if (!response.ok) {
    throw await trialErrorFromResponse(response);
  }

  return response.json();
}

export async function convertTrialSession(): Promise<TrialConvertResponse> {
  const response = await fetch(`${getApiBaseUrl()}/trial-sessions/convert`, {
    credentials: "include",
    method: "POST",
    cache: "no-store",
  });

  if (!response.ok) {
    handleAuthFailure(response);
    throw await trialErrorFromResponse(response);
  }

  return response.json();
}

async function trialErrorFromResponse(response: Response) {
  try {
    const payload = await response.json();
    const detail = payload?.detail;
    if (detail?.code && detail?.message) {
      return new TrialApiError(detail.code, detail.message);
    }
  } catch {
    // Fall through.
  }

  return new TrialApiError(
    "TRIAL_REQUEST_FAILED",
    "We couldn't continue the trial. Please try again.",
  );
}

function attributionContext() {
  if (typeof window === "undefined") {
    return {};
  }

  return getStoredAttributionContext() ?? captureAttribution();
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || "");
      resolve(value.includes(",") ? value.split(",")[1] ?? "" : value);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
