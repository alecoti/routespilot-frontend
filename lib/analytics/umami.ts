import type { AnalyticsEventName } from "./events";

declare global {
  interface Window {
    umami?: {
      track: (
        eventName: string,
        eventData?: Record<string, unknown>,
      ) => void | Promise<void>;
    };
  }
}

export function isUmamiEnabled() {
  return (
    process.env.NEXT_PUBLIC_UMAMI_ENABLED?.trim().toLowerCase() === "true" &&
    Boolean(process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID) &&
    Boolean(process.env.NEXT_PUBLIC_UMAMI_SCRIPT_URL)
  );
}

export async function trackUmamiEvent(
  name: AnalyticsEventName,
  properties: Record<string, unknown>,
) {
  if (typeof window === "undefined" || !isUmamiEnabled()) {
    return;
  }

  try {
    await window.umami?.track(name, properties);
  } catch {
    // Analytics must never block the product flow.
  }
}
