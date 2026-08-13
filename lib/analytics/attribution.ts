const ATTRIBUTION_STORAGE_KEY = "routespilot.analytics.attribution.v1";
const CORRELATION_STORAGE_KEY = "routesplan.analytics.correlation.v1";

const allowedAttributionKeys = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "referrer",
  "landing_path",
  "landing_variant",
] as const;

export type AttributionTouch = Partial<
  Record<(typeof allowedAttributionKeys)[number], string>
>;

export type StoredAttributionContext = {
  firstTouch: AttributionTouch;
  lastTouch: AttributionTouch;
};

export function captureAttribution(
  overrides: AttributionTouch = {},
): StoredAttributionContext {
  const touch = currentAttributionTouch(overrides);
  const existing = getStoredAttributionContext();
  const context = {
    firstTouch: existing?.firstTouch ?? touch,
    lastTouch: touch,
  };
  storeAttributionContext(context);
  return context;
}

export function getStoredAttributionContext(): StoredAttributionContext | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(ATTRIBUTION_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    return {
      firstTouch: sanitizeTouch(parsed?.firstTouch),
      lastTouch: sanitizeTouch(parsed?.lastTouch),
    };
  } catch {
    return null;
  }
}

export function getAnalyticsCorrelationId() {
  if (typeof window === "undefined") {
    return "server";
  }

  try {
    const existing = window.sessionStorage.getItem(CORRELATION_STORAGE_KEY);
    if (existing) {
      return existing;
    }
    const generated =
      window.crypto?.randomUUID?.() ??
      `anon_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    const opaque = `anon_${generated.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64)}`;
    window.sessionStorage.setItem(CORRELATION_STORAGE_KEY, opaque);
    return opaque;
  } catch {
    return "unavailable";
  }
}

function currentAttributionTouch(overrides: AttributionTouch) {
  if (typeof window === "undefined") {
    return sanitizeTouch(overrides);
  }

  const params = new URLSearchParams(window.location.search);
  return sanitizeTouch({
    utm_source: params.get("utm_source") ?? undefined,
    utm_medium: params.get("utm_medium") ?? undefined,
    utm_campaign: params.get("utm_campaign") ?? undefined,
    utm_content: params.get("utm_content") ?? undefined,
    utm_term: params.get("utm_term") ?? undefined,
    referrer: document.referrer || undefined,
    landing_path: window.location.pathname,
    landing_variant: "landing_v2",
    ...overrides,
  });
}

function sanitizeTouch(value: unknown): AttributionTouch {
  if (!value || typeof value !== "object") {
    return {};
  }

  const source = value as Record<string, unknown>;
  const sanitized: AttributionTouch = {};
  for (const key of allowedAttributionKeys) {
    const raw = source[key];
    if (raw === null || raw === undefined || raw === "") {
      continue;
    }
    sanitized[key] = String(raw).slice(0, 255);
  }
  return sanitized;
}

function storeAttributionContext(context: StoredAttributionContext) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(context));
  } catch {
    // Attribution capture must stay best-effort.
  }
}
