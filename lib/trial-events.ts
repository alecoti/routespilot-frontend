import {
  type AnalyticsEventName,
  type AnalyticsEventProperties,
  trackEvent,
} from "@/lib/analytics";

export function emitTrialFunnelEvent(
  name: AnalyticsEventName,
  detail: AnalyticsEventProperties<AnalyticsEventName>,
) {
  trackEvent(name, detail);
}
