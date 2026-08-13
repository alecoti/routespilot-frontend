import { getApiBaseUrl } from "@/lib/api/base-url";
import { handleAuthFailure } from "@/lib/api/auth";
import { persistenceHeaders } from "@/lib/api/persistence-context";
import {
  normalizeVehicleRouteGeometry,
  normalizeRoutingResult,
  type BackendVehicleRouteGeometry,
  type BackendRoutingResult,
} from "@/lib/api/optimizations";
import type { ExportFormat } from "@/lib/api/exports";
import type { RoutingProblem, RoutingResult, VehicleRouteGeometry } from "@/lib/types";

export type HistoryStatus =
  | "pending"
  | "processing"
  | "completed"
  | "infeasible"
  | "time_limit"
  | "failed";

export type ArchivedFilter = "active" | "archived" | "all";

export type OptimizationHistoryItem = {
  id: string;
  name?: string;
  status: HistoryStatus;
  createdAt: string;
  completedAt?: string;
  stopCount: number;
  vehicleCount: number;
  servedStopCount?: number;
  droppedStopCount?: number;
  totalDistanceMeters?: number;
  totalDurationSeconds?: number;
  estimatedCostMinor?: number;
  currency?: string;
  strategyMode?: string;
  strategyPreset?: string;
  hasSelectedVariant: boolean;
  archived: boolean;
};

export type OptimizationVariantSummary = {
  id: string;
  planType: string;
  status: string;
  vehiclesUsed?: number;
  distanceMeters?: number;
  durationSeconds?: number;
  estimatedCostMinor?: number;
  servedStopCount?: number;
  droppedStopCount?: number;
  isSelected: boolean;
  createdAt: string;
  completedAt?: string;
};

export type OptimizationHistoryDetail = {
  id: string;
  name?: string;
  conversationId?: string;
  status: HistoryStatus;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  archivedAt?: string;
  problemSchemaVersion: number;
  resultSchemaVersion?: number;
  problem: RoutingProblem;
  primaryResult?: RoutingResult;
  activeResult?: RoutingResult;
  activeResultSource: "primary" | "selected_variant" | "none";
  routeGeometries: VehicleRouteGeometry[];
  selectedVariant?: OptimizationVariantSummary;
  variants: OptimizationVariantSummary[];
  diagnostics?: unknown;
  errorCode?: string;
  errorMessage?: string;
};

export type OptimizationHistoryPage = {
  items: OptimizationHistoryItem[];
  nextCursor?: string;
};

type BackendHistoryPage = {
  items: BackendHistoryItem[];
  nextCursor?: string | null;
};

type BackendHistoryItem = {
  id: string;
  name?: string | null;
  status: HistoryStatus;
  created_at: string;
  completed_at?: string | null;
  stop_count: number;
  vehicle_count: number;
  served_stop_count?: number | null;
  dropped_stop_count?: number | null;
  total_distance_meters?: number | null;
  total_duration_seconds?: number | null;
  estimated_cost_minor?: number | null;
  currency?: string | null;
  strategy_mode?: string | null;
  strategy_preset?: string | null;
  has_selected_variant: boolean;
  archived: boolean;
};

type BackendHistoryDetail = {
  id: string;
  name?: string | null;
  conversationId?: string | null;
  status: HistoryStatus;
  createdAt: string;
  updatedAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
  archivedAt?: string | null;
  problemSchemaVersion: number;
  resultSchemaVersion?: number | null;
  problem: RoutingProblem;
  primaryResult?: BackendRoutingResult | null;
  activeResult?: BackendRoutingResult | null;
  activeResultSource: "primary" | "selected_variant" | "none";
  routeGeometries?: BackendVehicleRouteGeometry[] | null;
  selectedVariant?: BackendVariantSummary | null;
  variants?: BackendVariantSummary[];
  diagnostics?: unknown;
  errorCode?: string | null;
  errorMessage?: string | null;
};

type BackendVariantSummary = {
  id: string;
  planType: string;
  status: string;
  vehiclesUsed?: number | null;
  distanceMeters?: number | null;
  durationSeconds?: number | null;
  estimatedCostMinor?: number | null;
  servedStopCount?: number | null;
  droppedStopCount?: number | null;
  isSelected: boolean;
  createdAt: string;
  completedAt?: string | null;
};

type ApiErrorPayload = {
  detail?: {
    code?: string;
    message?: string;
  };
};

export class HistoryApiError extends Error {
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
    this.name = "HistoryApiError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export async function listOptimizationHistory({
  archived = "active",
  cursor,
  limit = 20,
  search,
  status,
}: {
  archived?: ArchivedFilter;
  cursor?: string;
  limit?: number;
  search?: string;
  status?: HistoryStatus;
} = {}): Promise<OptimizationHistoryPage> {
  const params = new URLSearchParams({
    archived,
    limit: String(limit),
  });

  if (cursor) {
    params.set("cursor", cursor);
  }

  if (search?.trim()) {
    params.set("search", search.trim());
  }

  if (status) {
    params.set("status", status);
  }

  const response = await fetch(`${getApiBaseUrl()}/optimizations?${params}`, {
    credentials: "include",
    headers: persistenceHeaders(),
    cache: "no-store",
  });
  const payload = (await readJson(response)) as BackendHistoryPage;

  if (!response.ok) {
    throw toHistoryApiError(response, payload);
  }

  return {
    items: payload.items.map(normalizeHistoryItem),
    nextCursor: payload.nextCursor ?? undefined,
  };
}

export async function getOptimizationHistoryDetail(
  optimizationId: string,
): Promise<OptimizationHistoryDetail> {
  const response = await fetch(`${getApiBaseUrl()}/optimizations/${optimizationId}`, {
    credentials: "include",
    headers: persistenceHeaders(),
    cache: "no-store",
  });
  const payload = (await readJson(response)) as BackendHistoryDetail;

  if (!response.ok) {
    throw toHistoryApiError(response, payload);
  }

  return normalizeHistoryDetail(payload);
}

export async function renameOptimization(
  optimizationId: string,
  name: string,
): Promise<OptimizationHistoryDetail> {
  const response = await fetch(`${getApiBaseUrl()}/optimizations/${optimizationId}`, {
    credentials: "include",
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...persistenceHeaders(),
    },
    body: JSON.stringify({ name }),
  });
  const payload = (await readJson(response)) as BackendHistoryDetail;

  if (!response.ok) {
    throw toHistoryApiError(response, payload);
  }

  return normalizeHistoryDetail(payload);
}

export async function saveOptimizationDraft(
  optimizationId: string,
  problem: RoutingProblem,
): Promise<OptimizationHistoryDetail> {
  const response = await fetch(
    `${getApiBaseUrl()}/optimizations/${optimizationId}/draft`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...persistenceHeaders(),
      },
      body: JSON.stringify(problem),
    },
  );
  const payload = (await readJson(response)) as BackendHistoryDetail;

  if (!response.ok) {
    throw toHistoryApiError(response, payload);
  }

  return normalizeHistoryDetail(payload);
}

export async function duplicateOptimization(
  optimizationId: string,
): Promise<RoutingProblem> {
  const response = await fetch(
    `${getApiBaseUrl()}/optimizations/${optimizationId}/duplicate`,
    {
      method: "POST",
      headers: persistenceHeaders(),
    },
  );
  const payload = (await readJson(response)) as { problem?: RoutingProblem };

  if (!response.ok || !payload.problem) {
    throw toHistoryApiError(response, payload);
  }

  return payload.problem;
}

export async function archiveOptimization(optimizationId: string) {
  await postArchiveAction(optimizationId, "archive");
}

export async function restoreOptimization(optimizationId: string) {
  await postArchiveAction(optimizationId, "restore");
}

export async function downloadHistoryExport(
  optimizationId: string,
  format: ExportFormat,
) {
  const response = await fetch(
    `${getApiBaseUrl()}/optimizations/${optimizationId}/exports`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...persistenceHeaders(),
      },
      body: JSON.stringify({ format }),
    },
  );

  if (!response.ok) {
    const payload = await readJson(response);
    throw toHistoryApiError(response, payload);
  }

  const blob = await response.blob();
  const filename =
    readFilename(response.headers.get("Content-Disposition")) ??
    fallbackFilename(format);

  triggerBrowserDownload(blob, filename);
}

async function postArchiveAction(
  optimizationId: string,
  action: "archive" | "restore",
) {
  const response = await fetch(
    `${getApiBaseUrl()}/optimizations/${optimizationId}/${action}`,
    {
      method: "POST",
      headers: persistenceHeaders(),
    },
  );

  if (!response.ok) {
    const payload = await readJson(response);
    throw toHistoryApiError(response, payload);
  }
}

function normalizeHistoryItem(item: BackendHistoryItem): OptimizationHistoryItem {
  return {
    id: item.id,
    name: item.name ?? undefined,
    status: item.status,
    createdAt: item.created_at,
    completedAt: item.completed_at ?? undefined,
    stopCount: item.stop_count,
    vehicleCount: item.vehicle_count,
    servedStopCount: item.served_stop_count ?? undefined,
    droppedStopCount: item.dropped_stop_count ?? undefined,
    totalDistanceMeters: item.total_distance_meters ?? undefined,
    totalDurationSeconds: item.total_duration_seconds ?? undefined,
    estimatedCostMinor: item.estimated_cost_minor ?? undefined,
    currency: item.currency ?? undefined,
    strategyMode: item.strategy_mode ?? undefined,
    strategyPreset: item.strategy_preset ?? undefined,
    hasSelectedVariant: item.has_selected_variant,
    archived: item.archived,
  };
}

function normalizeHistoryDetail(
  detail: BackendHistoryDetail,
): OptimizationHistoryDetail {
  return {
    id: detail.id,
    name: detail.name ?? undefined,
    conversationId: detail.conversationId ?? undefined,
    status: detail.status,
    createdAt: detail.createdAt,
    updatedAt: detail.updatedAt,
    startedAt: detail.startedAt ?? undefined,
    completedAt: detail.completedAt ?? undefined,
    archivedAt: detail.archivedAt ?? undefined,
    problemSchemaVersion: detail.problemSchemaVersion,
    resultSchemaVersion: detail.resultSchemaVersion ?? undefined,
    problem: detail.problem,
    primaryResult: detail.primaryResult
      ? normalizeRoutingResult(detail.primaryResult)
      : undefined,
    activeResult: detail.activeResult
      ? normalizeRoutingResult(detail.activeResult)
      : undefined,
    activeResultSource: detail.activeResultSource,
    routeGeometries: (detail.routeGeometries ?? []).map(
      normalizeVehicleRouteGeometry,
    ),
    selectedVariant: detail.selectedVariant
      ? normalizeVariantSummary(detail.selectedVariant)
      : undefined,
    variants: detail.variants?.map(normalizeVariantSummary) ?? [],
    diagnostics: detail.diagnostics,
    errorCode: detail.errorCode ?? undefined,
    errorMessage: detail.errorMessage ?? undefined,
  };
}

function normalizeVariantSummary(
  variant: BackendVariantSummary,
): OptimizationVariantSummary {
  return {
    id: variant.id,
    planType: variant.planType,
    status: variant.status,
    vehiclesUsed: variant.vehiclesUsed ?? undefined,
    distanceMeters: variant.distanceMeters ?? undefined,
    durationSeconds: variant.durationSeconds ?? undefined,
    estimatedCostMinor: variant.estimatedCostMinor ?? undefined,
    servedStopCount: variant.servedStopCount ?? undefined,
    droppedStopCount: variant.droppedStopCount ?? undefined,
    isSelected: variant.isSelected,
    createdAt: variant.createdAt,
    completedAt: variant.completedAt ?? undefined,
  };
}

async function readJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function toHistoryApiError(response: Response, payload: unknown) {
  handleAuthFailure(response);
  const error = payload as ApiErrorPayload;

  return new HistoryApiError({
    code: error.detail?.code ?? "HISTORY_REQUEST_FAILED",
    message:
      error.detail?.message ??
      "We couldn't load this optimization history. Please try again.",
    statusCode: response.status,
  });
}

function triggerBrowserDownload(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

function readFilename(contentDisposition: string | null) {
  if (!contentDisposition) {
    return null;
  }

  const encodedFilename = /filename\*=UTF-8''([^;]+)/i.exec(contentDisposition);

  if (encodedFilename?.[1]) {
    return decodeURIComponent(encodedFilename[1]);
  }

  const quotedFilename = /filename="([^"]+)"/i.exec(contentDisposition);

  return quotedFilename?.[1] ?? null;
}

function fallbackFilename(format: ExportFormat) {
  if (format === "driver_sheet") {
    return "routespilot-drivers.xlsx";
  }

  return format === "csv" ? "routespilot-plan.csv" : "routespilot-plan.xlsx";
}
