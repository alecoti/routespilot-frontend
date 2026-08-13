import { getApiBaseUrl } from "@/lib/api/base-url";
import { handleAuthFailure } from "@/lib/api/auth";

export type AdminMetricsPeriod = "today" | "7d" | "30d" | "all";

export type CountRow = {
  key: string;
  label: string;
  count: number;
};

export type FunnelStage = {
  key: string;
  label: string;
  count: number | null;
  source: "umami" | "routesplan_db";
  conversionFromPrevious: number | null;
};

export type Distribution = {
  average: number;
  median: number;
  p90: number;
};

export type RetentionSummary = {
  retained: number;
  eligible: number;
  rate: number;
  mature: boolean;
  label: string;
};

export type WeeklyCohort = {
  cohortStart: string;
  cohortSize: number;
  periods: Array<{
    period: number;
    activeCount: number | null;
    percentage: number | null;
    mature: boolean;
    label: string;
  }>;
  retainedCount: number | null;
  retainedPercentage: number | null;
};

export type AdminMetricsOverview = {
  period: AdminMetricsPeriod;
  generatedAt: string;
  range: {
    start: string | null;
    end: string;
    label: string;
  };
  summary: {
    visitors: number | null;
    signups: number;
    activatedOrganizations: number;
    completedOptimizations: number;
    activeOrganizations: number;
    optimizationSuccessRate: number;
    averageVariableCostPerRun: number;
    currency: string;
  };
  funnel: {
    sourceBoundary: string;
    stages: FunnelStage[];
  };
  activation: {
    signupToFirstOptimizationRate: number;
    medianSignupToFirstOptimizationSeconds: number | null;
    medianTimeToSecondOptimizationSeconds: number | null;
    firstToSecondOptimizationRate: number;
    newUsersWhoNeverOptimized: number;
    newOrganizationsThatOptimized: number;
  };
  activeOrganizations: {
    active7d: number;
    active30d: number;
    selectedPeriod: number;
    new: number;
    returning: number;
    definition: string;
  };
  retention: {
    definitions: Record<string, string>;
    d7: RetentionSummary;
    d30: RetentionSummary;
    rolling7: RetentionSummary;
    rolling30: RetentionSummary;
    weeklyCohorts: WeeklyCohort[];
    repeatUsage: {
      oneCompletedOptimization: number;
      twoPlusCompletedOptimizations: number;
      fivePlusCompletedOptimizations: number;
      tenPlusCompletedOptimizations: number;
      medianActiveDaysPerActiveOrganization30d: number;
    };
    selectedPeriod: {
      newActiveOrganizations: number;
      returningActiveOrganizations: number;
    };
  };
  usage: {
    completedOptimizationRuns: number;
    runsPerActiveOrganization: number;
    medianRunsPerActiveOrganization: number;
    attachmentsUploaded: number;
    attachmentsImported: number;
    attachmentImportRate: number;
    pdfsExported: number;
    pdfExportRate: number;
  };
  problemSize: {
    deliveries: Distribution;
    vehicles: Distribution;
  };
  reliability: {
    successRate: number;
    totalFailures: number;
    failureRate: number;
    failuresByStage: CountRow[];
    commonErrorCodes: CountRow[];
  };
  performance: {
    totalDurationMs: Distribution;
    geocodingDurationMs: Distribution;
    matrixDurationMs: Distribution;
    solverDurationMs: Distribution;
    geometryDurationMs: Distribution;
  };
  costs: {
    currency: string;
    total_variable_cost: number;
    average_variable_cost_per_run: number;
    median_variable_cost_per_run: number;
    ai_variable_cost: number;
    geoapify_variable_cost: number;
    other_metered_variable_cost: number;
    variable_cost_30d: number;
    cost_per_active_organization: number;
    estimated_monthly_infrastructure_cost: number;
    estimated_total_operating_cost_month: number;
    estimated: boolean;
  };
  acquisition: Array<{
    source: string;
    campaign: string;
    referrer: string;
    visitors: number | null;
    trials: number | null;
    signups: number;
    firstOptimizations: number;
    secondOptimizations: number;
    activeOrganizations: number;
    d7RetainedOrganizations: number;
    d30RetainedOrganizations: number;
    activationRate: number;
    d7RetentionRate: number;
    d30RetentionRate: number;
  }>;
  trialPath: Array<{
    source: string;
    trialStarts: number;
    authCompletions: number;
    firstOptimizations: number;
    secondOptimizations: number;
    d7RetainedOrganizations: number;
    activationRate: number;
    d7RetentionRate: number;
  }>;
  authMethods: CountRow[];
  recentActivity: Array<{
    id: string;
    label: string;
    eventName: string;
    occurredAt: string;
    organizationId?: string | null;
    userId?: string | null;
  }>;
  externalTools: {
    umami: ExternalToolLink;
    openReplay: ExternalToolLink;
  };
};

export type ExternalToolLink = {
  label: string;
  url?: string | null;
  summary: string;
  integrated: boolean;
};

export class AdminMetricsApiError extends Error {
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
    this.name = "AdminMetricsApiError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export async function getAdminMetricsOverview(
  period: AdminMetricsPeriod,
): Promise<AdminMetricsOverview> {
  const response = await fetch(
    `${getApiBaseUrl()}/admin/metrics/overview?period=${period}`,
    {
      credentials: "include",
      cache: "no-store",
    },
  );
  const payload = await readJson(response);

  if (!response.ok) {
    throw toAdminMetricsApiError(response, payload);
  }

  return payload as AdminMetricsOverview;
}

export async function exportAdminMetricsOverview(
  period: AdminMetricsPeriod,
): Promise<AdminMetricsOverview> {
  const response = await fetch(
    `${getApiBaseUrl()}/admin/metrics/overview/export?period=${period}`,
    {
      credentials: "include",
      cache: "no-store",
    },
  );
  const payload = await readJson(response);

  if (!response.ok) {
    throw toAdminMetricsApiError(response, payload);
  }

  return payload as AdminMetricsOverview;
}

async function readJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function toAdminMetricsApiError(response: Response, payload: unknown) {
  handleAuthFailure(response);
  const error = payload as {
    detail?: {
      code?: string;
      message?: string;
    };
  };

  return new AdminMetricsApiError({
    code: error.detail?.code ?? "ADMIN_METRICS_REQUEST_FAILED",
    message:
      error.detail?.message ??
      "We couldn't load internal metrics. Please try again.",
    statusCode: response.status,
  });
}
