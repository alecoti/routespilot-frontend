import { getApiBaseUrl } from "@/lib/api/base-url";
import { handleAuthFailure } from "@/lib/api/auth";
import { persistenceHeaders } from "@/lib/api/persistence-context";
import type {
  CapacityDimensionDefinition,
  GeoLocation,
  OptimizationStrategy,
  RoutingProblem,
  VehicleOperatingCost,
} from "@/lib/types";

export type OrganizationSettings = {
  organizationId: string;
  defaultCurrency: string;
  defaultTimezone: string;
  defaultReturnToDepot: boolean;
  defaultOptimizationStrategy?: OptimizationStrategy;
  defaultDepotLocationId?: string;
  createdAt: string;
  updatedAt: string;
};

export type LocationTemplateType =
  | "depot"
  | "warehouse"
  | "branch"
  | "supplier"
  | "other";

export type LocationTemplate = {
  id: string;
  organizationId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  formattedAddress?: string;
  providerReference?: string;
  locationType: LocationTemplateType;
  metadata?: Record<string, unknown>;
  isActive: boolean;
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type VehicleTemplate = {
  id: string;
  organizationId: string;
  name: string;
  externalReference?: string;
  capacities: Record<string, number>;
  capacityDimensions: CapacityDimensionDefinition[];
  operatingCost?: VehicleOperatingCost;
  metadata?: Record<string, unknown>;
  isActive: boolean;
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type UsageSummary = {
  period: {
    start: string;
    end: string;
    timezone: string;
  };
  optimizations: number;
  optimizationsCompleted: number;
  stopsOptimized: number;
  comparisons: number;
  exports: number;
  aiExtractions: number;
  updatedAt?: string;
};

export type OrganizationSettingsPatch = Partial<{
  defaultCurrency: string;
  defaultTimezone: string;
  defaultReturnToDepot: boolean;
  defaultOptimizationStrategy: OptimizationStrategy | null;
  defaultDepotLocationId: string | null;
}>;

export type LocationTemplatePayload = {
  name: string;
  address: string;
  locationType: LocationTemplateType;
  latitude?: number;
  longitude?: number;
};

export type VehicleTemplatePayload = {
  name: string;
  externalReference?: string | null;
  capacities?: Record<string, number>;
  capacityDimensions?: CapacityDimensionDefinition[];
  operatingCost?: VehicleOperatingCost | null;
};

type ApiErrorPayload = {
  detail?: {
    code?: string;
    message?: string;
  };
};

export class OrganizationConfigApiError extends Error {
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
    this.name = "OrganizationConfigApiError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export async function getOrganizationSettings() {
  const response = await fetch(`${getApiBaseUrl()}/organization/settings`, {
    credentials: "include",
    headers: persistenceHeaders(),
    cache: "no-store",
  });
  const payload = await readJson(response);

  if (!response.ok) {
    throw toApiError(response, payload);
  }

  return payload as OrganizationSettings;
}

export async function updateOrganizationSettings(
  patch: OrganizationSettingsPatch,
) {
  const response = await fetch(`${getApiBaseUrl()}/organization/settings`, {
    credentials: "include",
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...persistenceHeaders(),
    },
    body: JSON.stringify(patch),
  });
  const payload = await readJson(response);

  if (!response.ok) {
    throw toApiError(response, payload);
  }

  return payload as OrganizationSettings;
}

export async function getUsageSummary() {
  const response = await fetch(`${getApiBaseUrl()}/organization/usage`, {
    credentials: "include",
    headers: persistenceHeaders(),
    cache: "no-store",
  });
  const payload = await readJson(response);

  if (!response.ok) {
    throw toApiError(response, payload);
  }

  return payload as UsageSummary;
}

export async function listLocationTemplates(includeArchived = false) {
  const response = await fetch(
    `${getApiBaseUrl()}/locations/templates?include_archived=${includeArchived}`,
    {
      credentials: "include",
      headers: persistenceHeaders(),
      cache: "no-store",
    },
  );
  const payload = await readJson(response);

  if (!response.ok) {
    throw toApiError(response, payload);
  }

  return (payload as { items: LocationTemplate[] }).items;
}

export async function createLocationTemplate(payload: LocationTemplatePayload) {
  const response = await fetch(`${getApiBaseUrl()}/locations/templates`, {
    credentials: "include",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...persistenceHeaders(),
    },
    body: JSON.stringify(payload),
  });
  const responsePayload = await readJson(response);

  if (!response.ok) {
    throw toApiError(response, responsePayload);
  }

  return responsePayload as LocationTemplate;
}

export async function archiveLocationTemplate(templateId: string) {
  return postTemplateAction<LocationTemplate>(
    `/locations/templates/${templateId}/archive`,
  );
}

export async function restoreLocationTemplate(templateId: string) {
  return postTemplateAction<LocationTemplate>(
    `/locations/templates/${templateId}/restore`,
  );
}

export async function listVehicleTemplates(includeArchived = false) {
  const response = await fetch(
    `${getApiBaseUrl()}/vehicles/templates?include_archived=${includeArchived}`,
    {
      credentials: "include",
      headers: persistenceHeaders(),
      cache: "no-store",
    },
  );
  const payload = await readJson(response);

  if (!response.ok) {
    throw toApiError(response, payload);
  }

  return (payload as { items: VehicleTemplate[] }).items;
}

export async function createVehicleTemplate(payload: VehicleTemplatePayload) {
  const response = await fetch(`${getApiBaseUrl()}/vehicles/templates`, {
    credentials: "include",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...persistenceHeaders(),
    },
    body: JSON.stringify(payload),
  });
  const responsePayload = await readJson(response);

  if (!response.ok) {
    throw toApiError(response, responsePayload);
  }

  return responsePayload as VehicleTemplate;
}

export async function archiveVehicleTemplate(templateId: string) {
  return postTemplateAction<VehicleTemplate>(
    `/vehicles/templates/${templateId}/archive`,
  );
}

export async function restoreVehicleTemplate(templateId: string) {
  return postTemplateAction<VehicleTemplate>(
    `/vehicles/templates/${templateId}/restore`,
  );
}

export async function initializeRoutingProblem(options: {
  name?: string;
  problem?: RoutingProblem;
  vehicleTemplateIds?: string[];
} = {}) {
  const response = await fetch(`${getApiBaseUrl()}/routing-problems/initialize`, {
    credentials: "include",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...persistenceHeaders(),
    },
    body: JSON.stringify({
      name: options.name,
      problem: options.problem,
      vehicleTemplateIds: options.vehicleTemplateIds ?? [],
    }),
  });
  const payload = await readJson(response);

  if (!response.ok) {
    throw toApiError(response, payload);
  }

  return payload as {
    problem: RoutingProblem;
    selectedVehicleTemplates: string[];
  };
}

export function locationTemplateToDepot(template: LocationTemplate): GeoLocation {
  return {
    address: template.address,
    latitude: template.latitude,
    longitude: template.longitude,
    formattedAddress: template.formattedAddress,
    geocodingStatus: "resolved",
    geocodingConfirmed: true,
  };
}

async function postTemplateAction<T>(path: string) {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    credentials: "include",
    method: "POST",
    headers: persistenceHeaders(),
  });
  const payload = await readJson(response);

  if (!response.ok) {
    throw toApiError(response, payload);
  }

  return payload as T;
}

async function readJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function toApiError(response: Response, payload: unknown) {
  handleAuthFailure(response);
  const error = payload as ApiErrorPayload;

  return new OrganizationConfigApiError({
    code: error.detail?.code ?? "ORGANIZATION_CONFIG_REQUEST_FAILED",
    message:
      error.detail?.message ??
      "We couldn't update organization settings. Please try again.",
    statusCode: response.status,
  });
}
