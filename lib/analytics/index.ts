import {
  type AnalyticsEventName,
  type AnalyticsEventProperties,
} from "./events";
import { trackUmamiEvent } from "./umami";

export * from "./attribution";
export * from "./events";

const memoryDedupe = new Set<string>();

const unsafePropertyPatterns = [
  /address/i,
  /code/i,
  /conversation/i,
  /customer/i,
  /email/i,
  /file/i,
  /message/i,
  /name/i,
  /otp/i,
  /planning/i,
  /session/i,
  /token/i,
  /user/i,
];

type TrackOptions = {
  dedupeKey?: string;
};

export function trackEvent<Name extends AnalyticsEventName>(
  name: Name,
  properties: AnalyticsEventProperties<Name>,
  options: TrackOptions = {},
) {
  if (typeof window === "undefined") {
    return;
  }

  const dedupeKey = options.dedupeKey;
  if (dedupeKey && hasTracked(dedupeKey)) {
    return;
  }
  if (dedupeKey) {
    markTracked(dedupeKey);
  }

  const safeProperties = sanitizeAnalyticsProperties(properties);
  const correlationId = getCorrelationIdForEvent();
  if (correlationId) {
    safeProperties.analytics_correlation_id = correlationId;
  }
  debugAnalyticsEvent(name, safeProperties);

  window.dispatchEvent(
    new CustomEvent("routespilot:analytics-event", {
      detail: { name, properties: safeProperties },
    }),
  );

  void trackUmamiEvent(name, safeProperties);
}

export function sanitizeAnalyticsProperties(
  properties: Record<string, unknown>,
): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (unsafePropertyPatterns.some((pattern) => pattern.test(key))) {
      continue;
    }
    if (value === null || value === undefined) {
      continue;
    }
    if (typeof value === "string") {
      if (value.includes("@") || value.length > 80) {
        continue;
      }
      safe[key] = value;
      continue;
    }
    if (typeof value === "boolean" || typeof value === "number") {
      safe[key] = value;
    }
  }
  return safe;
}

function hasTracked(key: string) {
  if (memoryDedupe.has(key)) {
    return true;
  }
  try {
    return window.sessionStorage.getItem(dedupeStorageKey(key)) === "1";
  } catch {
    return false;
  }
}

function markTracked(key: string) {
  memoryDedupe.add(key);
  try {
    window.sessionStorage.setItem(dedupeStorageKey(key), "1");
  } catch {
    // Memory dedupe still covers the active render cycle.
  }
}

function dedupeStorageKey(key: string) {
  return `routespilot.analytics.once.${key}`;
}

function debugAnalyticsEvent(
  name: AnalyticsEventName,
  properties: Record<string, unknown>,
) {
  if (process.env.NEXT_PUBLIC_ANALYTICS_DEBUG?.trim().toLowerCase() !== "true") {
    return;
  }
  console.info("[RoutesPlan Analytics]", name, properties);
}

function getCorrelationIdForEvent() {
  try {
    return window.sessionStorage.getItem("routesplan.analytics.correlation.v1");
  } catch {
    return null;
  }
}
