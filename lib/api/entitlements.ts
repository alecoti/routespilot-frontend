import { getApiBaseUrl } from "@/lib/api/base-url";
import { handleAuthFailure } from "@/lib/api/auth";
import { persistenceHeaders } from "@/lib/api/persistence-context";

export type CapabilitySet = {
  canOptimize: boolean;
  canComparePlans: boolean;
  canUseAdvancedStrategy: boolean;
  canUseOperatingCost: boolean;
  canUseMultiCapacity: boolean;
  canUsePickupDelivery: boolean;
  canExportCsv: boolean;
  canExportXlsx: boolean;
  canExportDriverSheet: boolean;
  canUseAiExtraction: boolean;
  canUseSavedVehicleTemplates: boolean;
  canUseSavedLocations: boolean;
};

export type EntitlementLimits = {
  maxStopsPerOptimization?: number | null;
  maxVehiclesPerOptimization?: number | null;
  monthlyOptimizationLimit?: number | null;
  monthlyStopLimit?: number | null;
  monthlyComparisonLimit?: number | null;
  monthlyAiExtractionLimit?: number | null;
  maxSavedVehicleTemplates?: number | null;
  maxSavedLocationTemplates?: number | null;
};

export type UsageLimitStatus = {
  used: number;
  limit?: number | null;
  remaining?: number | null;
};

export type OrganizationEntitlements = {
  planCode: string;
  planLabel: string;
  subscriptionStatus:
    | "trialing"
    | "active"
    | "past_due"
    | "canceled"
    | "expired"
    | "paused";
  accessState: "full" | "limited" | "blocked";
  capabilities: CapabilitySet;
  limits: EntitlementLimits;
  usage: {
    optimizations: UsageLimitStatus;
    stops: UsageLimitStatus;
    comparisons: UsageLimitStatus;
    aiExtractions: UsageLimitStatus;
  };
  subscription?: {
    provider: "manual" | "internal" | "stripe";
    status: OrganizationEntitlements["subscriptionStatus"];
    planCode: string;
    currentPeriodStart?: string | null;
    currentPeriodEnd?: string | null;
    cancelAtPeriodEnd: boolean;
    trialEnd?: string | null;
    gracePeriodEnd?: string | null;
  } | null;
};

type ApiErrorPayload = {
  detail?: {
    code?: string;
    message?: string;
  };
};

export class EntitlementsApiError extends Error {
  code: string;
  statusCode: number;

  constructor({
    code,
    message,
    statusCode,
  }: {
    code: string;
    message: string;
    statusCode: number;
  }) {
    super(message);
    this.name = "EntitlementsApiError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export async function getOrganizationEntitlements() {
  const response = await fetch(`${getApiBaseUrl()}/organization/entitlements`, {
    credentials: "include",
    headers: persistenceHeaders(),
    cache: "no-store",
  });
  const payload = await readJson(response);
  handleAuthFailure(response);

  if (!response.ok) {
    const error = payload as ApiErrorPayload;

    throw new EntitlementsApiError({
      code: error.detail?.code ?? "ENTITLEMENTS_REQUEST_FAILED",
      message:
        error.detail?.message ?? "We couldn't load subscription entitlements.",
      statusCode: response.status,
    });
  }

  return payload as OrganizationEntitlements;
}

async function readJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}
