export const analyticsEvents = {
  landingPrimaryCtaClicked: "landing_primary_cta_clicked",
  landingSecondaryCtaClicked: "landing_secondary_cta_clicked",
  trialStarted: "trial_started",
  trialSourceSelected: "trial_source_selected",
  trialDescriptionSubmitted: "trial_description_submitted",
  trialFileSelected: "trial_file_selected",
  trialFileInspected: "trial_file_inspected",
  trialValueReached: "trial_value_reached",
  authGateShown: "auth_gate_shown",
  authMethodSelected: "auth_method_selected",
  authStarted: "auth_started",
  authCompleted: "auth_completed",
  trialConverted: "trial_converted",
  trialFailed: "trial_failed",
  trialFileInspectionFailed: "trial_file_inspection_failed",
  authFailed: "auth_failed",
  trialConversionFailed: "trial_conversion_failed",
} as const;

export type AnalyticsEventName =
  (typeof analyticsEvents)[keyof typeof analyticsEvents];

export type CtaLocation = "navbar" | "hero" | "mid_page" | "final";
export type TrialSource = "describe" | "upload" | "example";
export type AuthMethod = "email_otp" | "google" | "microsoft";
export type GateReason = "message" | "upload" | "continue_trial";
export type TrialValueType = "description_interpreted" | "file_inspected";
export type ErrorCategory =
  | "auth_required"
  | "expired"
  | "invalid_input"
  | "limit_reached"
  | "rate_limited"
  | "upload_failed"
  | "network"
  | "unknown";

export type AnalyticsPropertiesByEvent = {
  landing_primary_cta_clicked: { cta_location: CtaLocation };
  landing_secondary_cta_clicked: { cta_location: CtaLocation };
  trial_started: { trial_source?: TrialSource };
  trial_source_selected: { trial_source: TrialSource };
  trial_description_submitted: { trial_source: TrialSource };
  trial_file_selected: { trial_source: "upload" };
  trial_file_inspected: { trial_source: "upload" };
  trial_value_reached: {
    trial_source: TrialSource;
    value_type: TrialValueType;
  };
  auth_gate_shown: {
    trial_source: TrialSource;
    gate_reason: GateReason;
  };
  auth_method_selected: { auth_method: AuthMethod };
  auth_started: { auth_method: AuthMethod };
  auth_completed: { auth_method: AuthMethod };
  trial_converted: {
    trial_source: TrialSource;
    auth_method?: AuthMethod;
    conversion_status?: "new" | "already_converted";
  };
  trial_failed: { error_category: ErrorCategory };
  trial_file_inspection_failed: { error_category: ErrorCategory };
  auth_failed: { auth_method?: AuthMethod; error_category: ErrorCategory };
  trial_conversion_failed: { error_category: ErrorCategory };
};

export type AnalyticsEventProperties<Name extends AnalyticsEventName> =
  AnalyticsPropertiesByEvent[Name];

export const authMethods = ["email_otp", "google", "microsoft"] as const;

export function isAuthMethod(value: unknown): value is AuthMethod {
  return typeof value === "string" && authMethods.includes(value as AuthMethod);
}
