import { getApiBaseUrl } from "@/lib/api/base-url";
import { handleAuthFailure } from "@/lib/api/auth";
import { persistenceHeaders } from "@/lib/api/persistence-context";
import type { RoutingProblem, RoutingResult } from "@/lib/types";

export type ExportFormat = "csv" | "xlsx" | "driver_sheet" | "pdf";

type BackendRoutingResult = {
  problem_id: string;
  feasible: boolean;
  routes: BackendVehicleRouteResult[];
  total_distance_meters: number;
  total_duration_seconds: number;
  vehicles_used: number;
  warnings: string[];
  solver_status: "feasible" | "infeasible" | "invalid" | "time_limit";
  solve_time_ms: number;
  dropped_stops: BackendDroppedStopResult[];
  served_stops: number;
  dropped_stops_count: number;
  operating_cost?: BackendOperatingCostSummary;
};

type BackendOperatingCostSummary = {
  currency: string;
  total: BackendOperatingCostBreakdown;
  vehicles: BackendVehicleOperatingCostBreakdown[];
};

type BackendVehicleOperatingCostBreakdown = {
  vehicle_id: string;
  breakdown: BackendOperatingCostBreakdown;
};

type BackendOperatingCostBreakdown = {
  fixed_cost_minor: number;
  distance_cost_minor: number;
  time_cost_minor: number;
  overtime_cost_minor: number;
  soft_penalty_cost_minor?: number;
  total_cost_minor: number;
  currency: string;
};

type BackendDroppedStopResult = {
  stop_id: string;
  job_id?: string;
  stop_role?: "delivery" | "pickup" | "dropoff";
  reason: string;
  penalty?: number;
  priority: "critical" | "high" | "normal" | "low";
  service_policy: "required" | "preferred" | "optional";
};

type BackendVehicleRouteResult = {
  vehicle_id: string;
  stops: BackendRouteStopResult[];
  distance_meters: number;
  duration_seconds: number;
  total_load?: number;
  capacity_usage?: RoutingResult["routes"][number]["capacityUsage"];
  start_time?: number;
  end_time?: number;
};

type BackendRouteStopResult = {
  stop_id: string;
  job_id?: string;
  stop_role?: "delivery" | "pickup" | "dropoff";
  sequence: number;
  eta_seconds?: number;
  time_window_lateness_seconds?: number;
  load_after_stop?: number;
  loads_after_stop?: Record<string, number>;
  distance_from_previous_meters?: number;
  duration_from_previous_seconds?: number;
};

type ExportFailurePayload = {
  error?: {
    code?: string;
    message?: string;
  };
};

export class ExportApiError extends Error {
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
    this.name = "ExportApiError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export function downloadCsv(problem: RoutingProblem, result: RoutingResult) {
  return downloadExport({ format: "csv", problem, result });
}

export function downloadXlsx(problem: RoutingProblem, result: RoutingResult) {
  return downloadExport({ format: "xlsx", problem, result });
}

export function downloadDriverSheet(
  problem: RoutingProblem,
  result: RoutingResult,
) {
  return downloadExport({ format: "driver_sheet", problem, result });
}

export function downloadPdfPlan({
  problem,
  result,
  vehicleIds,
}: {
  problem: RoutingProblem;
  result: RoutingResult;
  vehicleIds?: string[];
}) {
  return downloadExport({ format: "pdf", problem, result, vehicleIds });
}

async function downloadExport({
  format,
  problem,
  result,
  vehicleIds,
}: {
  format: ExportFormat;
  problem: RoutingProblem;
  result: RoutingResult;
  vehicleIds?: string[];
}) {
  const response = await fetch(`${getApiBaseUrl()}/exports`, {
    credentials: "include",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...persistenceHeaders(),
    },
    body: JSON.stringify({
      format,
      problem,
      result: toBackendRoutingResult(result),
      ...(vehicleIds?.length ? { vehicleIds } : {}),
    }),
  });

  if (!response.ok) {
    throw await toExportApiError(response);
  }

  const blob = await response.blob();
  const filename =
    readFilename(response.headers.get("Content-Disposition")) ??
    fallbackFilename(format);

  triggerBrowserDownload(blob, filename);
}

function toBackendRoutingResult(result: RoutingResult): BackendRoutingResult {
  const servedStops = result.servedStops ?? countServedStops(result);
  const droppedStops = result.droppedStops ?? [];

  return {
    problem_id: result.problemId,
    feasible: result.feasible,
    routes: result.routes.map((route) => ({
      vehicle_id: route.vehicleId,
      stops: route.stops.map((stop) => ({
        stop_id: stop.stopId,
        job_id: stop.jobId,
        stop_role: stop.stopRole,
        sequence: stop.order,
        eta_seconds: stop.etaSeconds ?? parseTimeToSeconds(stop.eta),
        time_window_lateness_seconds: stop.timeWindowLatenessSeconds,
        load_after_stop: stop.loadAfterStop,
        loads_after_stop: stop.loadsAfterStop,
        distance_from_previous_meters:
          stop.distanceFromPreviousMeters ??
          kilometersToMeters(stop.distanceFromPreviousKm),
        duration_from_previous_seconds:
          stop.durationFromPreviousSeconds ??
          minutesToSeconds(stop.durationFromPreviousMinutes),
      })),
      distance_meters:
        route.distanceMeters ?? kilometersToMeters(route.distanceKm) ?? 0,
      duration_seconds:
        route.durationSeconds ?? minutesToSeconds(route.durationMinutes) ?? 0,
      total_load: route.totalLoad,
      capacity_usage: route.capacityUsage,
      start_time: route.startTimeSeconds,
      end_time: route.endTimeSeconds,
    })),
    total_distance_meters:
      result.totalDistanceMeters ?? kilometersToMeters(result.totalDistanceKm) ?? 0,
    total_duration_seconds:
      result.totalDurationSeconds ??
      minutesToSeconds(result.totalDurationMinutes) ??
      0,
    vehicles_used: result.vehiclesUsed,
    warnings: result.warnings,
    solver_status: result.solverStatus,
    solve_time_ms: result.solveTimeMs,
    dropped_stops: droppedStops.map((stop) => ({
      stop_id: stop.stopId,
      job_id: stop.jobId,
      stop_role: stop.stopRole,
      reason: stop.reason,
      penalty: stop.penalty,
      priority: stop.priority,
      service_policy: stop.servicePolicy,
    })),
    served_stops: servedStops,
    dropped_stops_count: result.droppedStopsCount ?? droppedStops.length,
    operating_cost: result.operatingCost
      ? {
          currency: result.operatingCost.currency,
          total: toBackendOperatingCostBreakdown(result.operatingCost.total),
          vehicles: result.operatingCost.vehicles.map((vehicle) => ({
            vehicle_id: vehicle.vehicleId,
            breakdown: toBackendOperatingCostBreakdown(vehicle.breakdown),
          })),
        }
      : undefined,
  };
}

function toBackendOperatingCostBreakdown(
  breakdown: NonNullable<RoutingResult["operatingCost"]>["total"],
): BackendOperatingCostBreakdown {
  return {
    fixed_cost_minor: breakdown.fixedCostMinor,
    distance_cost_minor: breakdown.distanceCostMinor,
    time_cost_minor: breakdown.timeCostMinor,
    overtime_cost_minor: breakdown.overtimeCostMinor,
    soft_penalty_cost_minor: breakdown.softPenaltyCostMinor,
    total_cost_minor: breakdown.totalCostMinor,
    currency: breakdown.currency,
  };
}

async function toExportApiError(response: Response) {
  handleAuthFailure(response);
  const payload = await readFailurePayload(response);

  return new ExportApiError({
    code: payload?.error?.code ?? "EXPORT_GENERATION_FAILED",
    message:
      payload?.error?.message ??
      "We couldn't generate this file. Please try again.",
    statusCode: response.status,
  });
}

async function readFailurePayload(response: Response) {
  try {
    return (await response.json()) as ExportFailurePayload;
  } catch {
    return null;
  }
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

  if (quotedFilename?.[1]) {
    return quotedFilename[1];
  }

  return null;
}

function fallbackFilename(format: ExportFormat) {
  if (format === "driver_sheet") {
    return "routespilot-drivers.xlsx";
  }

  if (format === "pdf") {
    return "routespilot-plan.pdf";
  }

  return format === "csv" ? "routespilot-plan.csv" : "routespilot-plan.xlsx";
}

function kilometersToMeters(value?: number) {
  return typeof value === "number" ? Math.round(value * 1000) : undefined;
}

function minutesToSeconds(value?: number) {
  return typeof value === "number" ? Math.round(value * 60) : undefined;
}

function parseTimeToSeconds(value?: string) {
  if (!value) {
    return undefined;
  }

  const match = /^(\d{1,2}):([0-5]\d)$/.exec(value);

  if (!match) {
    return undefined;
  }

  const hours = Number(match[1]);

  if (hours > 23) {
    return undefined;
  }

  return hours * 3600 + Number(match[2]) * 60;
}

function countServedStops(result: RoutingResult) {
  return result.routes.reduce((count, route) => count + route.stops.length, 0);
}
