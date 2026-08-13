"use client";

import type OpenReplay from "@openreplay/tracker";

import {
  sanitizeReplayNetworkData,
  sanitizeReplayUrl,
} from "@/lib/replay/privacy";

type OpenReplayTracker = InstanceType<typeof OpenReplay>;

let tracker: OpenReplayTracker | null = null;
let startPromise: Promise<void> | null = null;

export type ReplaySurface = "landing" | "try" | "auth" | "app";

export type ReplayMetadata = {
  surface?: ReplaySurface;
  trial_source?: "describe" | "upload" | "example";
  user_state?: "anonymous" | "new" | "returning";
  analytics_correlation_id?: string;
};

export async function startOpenReplay(metadata: ReplayMetadata = {}) {
  if (!shouldStartOpenReplay()) {
    return;
  }
  if (startPromise) {
    return startPromise;
  }

  startPromise = (async () => {
    try {
      const { default: Tracker, SanitizeLevel } = await import(
        "@openreplay/tracker"
      );
      tracker = new Tracker({
        projectKey: process.env.NEXT_PUBLIC_OPENREPLAY_PROJECT_KEY,
        ingestPoint: process.env.NEXT_PUBLIC_OPENREPLAY_INGEST_URL,
        privateMode: true,
        respectDoNotTrack: true,
        captureExceptions: true,
        capturePerformance: true,
        captureResourceTimings: true,
        network: {
          capturePayload: false,
          captureInIframes: false,
          failuresOnly: false,
          ignoreHeaders: true,
          sessionTokenHeader: false,
          sanitizer: sanitizeReplayNetworkData,
          tokenUrlMatcher: (url) => sanitizeReplayUrl(url) !== url,
        },
        domSanitizer: (node) =>
          node.closest("[data-openreplay-masked], [data-private]")
            ? SanitizeLevel.Hidden
            : SanitizeLevel.Obscured,
      });

      const session = await tracker.start({
        metadata: sanitizeReplayMetadata(metadata),
      });
      if (session.success) {
        window.dispatchEvent(
          new CustomEvent("routesplan:replay-started", {
            detail: { sessionID: session.sessionID },
          }),
        );
      }
    } catch {
      // Replay must never block product usage.
    }
  })();

  return startPromise;
}

export function setReplayMetadata(key: keyof ReplayMetadata, value: string) {
  if (!tracker || !isSafeMetadataValue(value)) {
    return;
  }
  try {
    tracker.setMetadata(key, value);
  } catch {
    // Best-effort only.
  }
}

export function trackReplayEvent(
  name: string,
  properties: Record<string, string> = {},
) {
  if (!tracker) {
    return;
  }
  try {
    tracker.track(name, sanitizeReplayMetadata(properties));
  } catch {
    // Best-effort only.
  }
}

export function getReplaySessionId() {
  try {
    return tracker?.getSessionID() ?? null;
  } catch {
    return null;
  }
}

export function shouldStartOpenReplay() {
  if (typeof window === "undefined") {
    return false;
  }
  if (
    process.env.NEXT_PUBLIC_OPENREPLAY_ENABLED?.trim().toLowerCase() !== "true"
  ) {
    return false;
  }
  if (
    !process.env.NEXT_PUBLIC_OPENREPLAY_PROJECT_KEY ||
    !process.env.NEXT_PUBLIC_OPENREPLAY_INGEST_URL
  ) {
    return false;
  }
  if (window.location.hostname === "localhost") {
    return (
      process.env.NEXT_PUBLIC_OPENREPLAY_ALLOW_LOCALHOST?.trim().toLowerCase() ===
      "true"
    );
  }
  if (/bot|crawl|spider|headless/i.test(window.navigator.userAgent)) {
    return false;
  }
  return shouldSampleSession();
}

function shouldSampleSession() {
  const rate = Number(process.env.NEXT_PUBLIC_OPENREPLAY_SAMPLE_RATE ?? "1");
  if (!Number.isFinite(rate) || rate <= 0) {
    return false;
  }
  if (rate >= 1) {
    return true;
  }

  const key = "routesplan.replay.sample.v1";
  try {
    const existing = window.sessionStorage.getItem(key);
    if (existing) {
      return existing === "1";
    }
    const sampled = Math.random() < rate;
    window.sessionStorage.setItem(key, sampled ? "1" : "0");
    return sampled;
  } catch {
    return Math.random() < rate;
  }
}

function sanitizeReplayMetadata<T extends Record<string, string | undefined>>(
  metadata: T,
) {
  const safe: Record<string, string> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (!value || !isSafeMetadataKey(key) || !isSafeMetadataValue(value)) {
      continue;
    }
    safe[key] = value;
  }
  return safe;
}

function isSafeMetadataKey(key: string) {
  return !/email|name|address|token|session|conversation|user_id|org/i.test(key);
}

function isSafeMetadataValue(value: string) {
  return value.length <= 80 && !value.includes("@");
}
