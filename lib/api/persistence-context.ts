import { authHeaders, getAuthSession } from "@/lib/api/auth";

export function persistenceHeaders(options?: { idempotencyKey?: string }) {
  const session = getAuthSession();
  const organizationId =
    session?.organization.id ??
    process.env.NEXT_PUBLIC_ROUTESPILOT_ORGANIZATION_ID?.trim();
  const userId =
    session?.user.id ?? process.env.NEXT_PUBLIC_ROUTESPILOT_USER_ID?.trim();
  const headers: Record<string, string> = {};

  Object.assign(headers, authHeaders());

  if (organizationId) {
    headers["X-RoutesPilot-Organization-Id"] = organizationId;
  }

  if (userId) {
    headers["X-RoutesPilot-User-Id"] = userId;
  }

  if (options?.idempotencyKey) {
    headers["Idempotency-Key"] = options.idempotencyKey;
  }

  return headers;
}

export function hasPersistenceContext() {
  return Boolean(
    getAuthSession()?.organization.id ||
      process.env.NEXT_PUBLIC_ROUTESPILOT_ORGANIZATION_ID?.trim(),
  );
}

export function createIdempotencyKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `request-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
