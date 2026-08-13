import { getApiBaseUrl } from "@/lib/api/base-url";

const AUTH_STORAGE_KEY = "routespilot.auth.context.v1";
const PENDING_EMAIL_STORAGE_KEY = "routespilot.auth.pendingEmail";
const PENDING_DEMO_CODE_STORAGE_KEY = "routespilot.auth.pendingDemoCode";
export const AUTH_SESSION_EXPIRED_EVENT = "routespilot:auth-session-expired";

let lastExpiredNotificationAt = 0;

export type AuthSession = {
  user: {
    id: string;
    email: string;
  };
  organization: {
    id: string;
    name: string;
  };
  membership: {
    role: string;
  };
  planCode: string;
  isInternalAdmin?: boolean;
};

type RequestCodeResponse = {
  ok: boolean;
  email: string;
  expiresInSeconds: number;
  resendAfterSeconds: number;
  demoCode?: string | null;
};

export class AuthApiError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "AuthApiError";
    this.code = code;
  }
}

export async function requestEmailCode(
  email: string,
): Promise<RequestCodeResponse> {
  const response = await fetch(`${getApiBaseUrl()}/auth/email/request-code`, {
    body: JSON.stringify({ email }),
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });

  if (!response.ok) {
    throw await authErrorFromResponse(response);
  }

  const payload = (await response.json()) as RequestCodeResponse;
  setPendingAuthEmail(payload.email);
  setPendingDemoCode(payload.demoCode ?? null);
  return payload;
}

export async function verifyEmailCode(
  email: string,
  code: string,
): Promise<AuthSession> {
  const response = await fetch(`${getApiBaseUrl()}/auth/email/verify-code`, {
    body: JSON.stringify({ email, code }),
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });

  if (!response.ok) {
    throw await authErrorFromResponse(response);
  }

  const session = (await response.json()) as AuthSession;
  saveAuthSession(session);
  clearPendingAuth();
  return session;
}

export async function fetchCurrentAuthSession(): Promise<AuthSession> {
  const response = await fetch(`${getApiBaseUrl()}/auth/me`, {
    credentials: "include",
    method: "GET",
  });

  if (!response.ok) {
    clearAuthSession();
    throw await authErrorFromResponse(response);
  }

  const session = (await response.json()) as AuthSession;
  saveAuthSession(session);
  return session;
}

export async function logout(): Promise<void> {
  const response = await fetch(`${getApiBaseUrl()}/auth/logout`, {
    credentials: "include",
    method: "POST",
  });

  clearAuthSession();

  if (!response.ok) {
    throw await authErrorFromResponse(response);
  }
}

export async function logoutAll(): Promise<void> {
  const response = await fetch(`${getApiBaseUrl()}/auth/logout-all`, {
    credentials: "include",
    method: "POST",
  });

  clearAuthSession();

  if (!response.ok) {
    throw await authErrorFromResponse(response);
  }
}

export function authHeaders(): Record<string, string> {
  return {};
}

export function handleAuthFailure(response: Response): boolean {
  if (response.status !== 401) {
    return false;
  }

  notifyAuthSessionExpired();
  return true;
}

export function getGoogleAuthStartUrl(next = "/dashboard") {
  const safeNext =
    next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  return `${getApiBaseUrl()}/auth/google/start?next=${encodeURIComponent(safeNext)}`;
}

export function getMicrosoftAuthStartUrl(next = "/dashboard") {
  const safeNext =
    next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  return `${getApiBaseUrl()}/auth/microsoft/start?next=${encodeURIComponent(safeNext)}`;
}

export function saveAuthSession(session: AuthSession) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

export function getAuthSession(): AuthSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AuthSession>;
    if (
      parsed.user?.id &&
      parsed.user.email &&
      parsed.organization?.id &&
      parsed.organization.name &&
      parsed.membership?.role
    ) {
      return parsed as AuthSession;
    }
  } catch {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
  }

  return null;
}

export function clearAuthSession() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(AUTH_STORAGE_KEY);
}

export function notifyAuthSessionExpired(message = "Your session expired. Sign in again.") {
  if (typeof window === "undefined") {
    return;
  }

  const now = Date.now();
  if (now - lastExpiredNotificationAt < 1500) {
    return;
  }
  lastExpiredNotificationAt = now;
  clearAuthSession();
  window.dispatchEvent(
    new CustomEvent(AUTH_SESSION_EXPIRED_EVENT, {
      detail: { message },
    }),
  );
}

export function setPendingAuthEmail(email: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(PENDING_EMAIL_STORAGE_KEY, email);
}

export function getPendingAuthEmail() {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem(PENDING_EMAIL_STORAGE_KEY) ?? "";
}

export function setPendingDemoCode(code: string | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (code) {
    window.localStorage.setItem(PENDING_DEMO_CODE_STORAGE_KEY, code);
  } else {
    window.localStorage.removeItem(PENDING_DEMO_CODE_STORAGE_KEY);
  }
}

export function getPendingDemoCode() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(PENDING_DEMO_CODE_STORAGE_KEY);
}

function clearPendingAuth() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(PENDING_EMAIL_STORAGE_KEY);
  window.localStorage.removeItem(PENDING_DEMO_CODE_STORAGE_KEY);
}

async function authErrorFromResponse(response: Response) {
  handleAuthFailure(response);

  try {
    const payload = await response.json();
    const detail = payload?.detail;
    if (detail?.code && detail?.message) {
      return new AuthApiError(detail.code, friendlyAuthMessage(detail.code, detail.message));
    }
  } catch {
    // Fall through to the generic message below.
  }

  return new AuthApiError(
    "AUTH_REQUEST_FAILED",
    "We couldn't complete the login request. Please try again.",
  );
}

function friendlyAuthMessage(code: string, fallback: string) {
  if (code === "AUTH_OTP_INVALID") {
    return "That code isn't correct. Try again.";
  }

  if (code === "AUTH_OTP_EXPIRED") {
    return "That code has expired. Request a new one.";
  }

  if (code === "AUTH_OTP_TOO_MANY_ATTEMPTS" || code === "AUTH_RATE_LIMITED") {
    return "Too many attempts. Please wait before trying again.";
  }

  if (code === "AUTH_OTP_RESEND_TOO_SOON") {
    return fallback;
  }

  return fallback;
}
