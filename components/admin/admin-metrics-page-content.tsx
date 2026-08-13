"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  BarChart3,
  CalendarDays,
  Database,
  Download,
  ExternalLink,
  Gauge,
  Loader2,
  MousePointerClick,
  RefreshCcw,
  ShieldAlert,
  Sparkles,
  Timer,
  Users,
} from "lucide-react";

import {
  exportAdminMetricsOverview,
  getAdminMetricsOverview,
  type AdminMetricsApiError,
  type AdminMetricsOverview,
  type AdminMetricsPeriod,
  type CountRow,
  type Distribution,
  type ExternalToolLink,
  type FunnelStage,
} from "@/lib/api/admin-metrics";
import { cn } from "@/lib/utils";

const periods: Array<{ label: string; value: AdminMetricsPeriod }> = [
  { label: "Today", value: "today" },
  { label: "7 days", value: "7d" },
  { label: "30 days", value: "30d" },
  { label: "All time", value: "all" },
];

export function AdminMetricsPageContent() {
  const [period, setPeriod] = useState<AdminMetricsPeriod>("30d");
  const [metrics, setMetrics] = useState<AdminMetricsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<AdminMetricsApiError | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setMetrics(await getAdminMetricsOverview(period));
    } catch (err) {
      setError(err as AdminMetricsApiError);
      setMetrics(null);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void load();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [load]);

  const exportJson = useCallback(async () => {
    setExporting(true);
    try {
      const payload = await exportAdminMetricsOverview(period);
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `routesplan-admin-metrics-${period}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }, [period]);

  return (
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6 px-4 py-6 md:px-8 md:py-8">
      <header className="flex flex-col gap-4 border-b border-border pb-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="font-display text-xs font-semibold uppercase text-primary-accent">
            Internal
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold text-foreground">
            Admin metrics
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Product traction, activation, reliability and operating cost from
            RoutesPlan authoritative data, with quick links to marketing
            analytics and session replay.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-border bg-card p-1">
            {periods.map((item) => (
              <button
                className={cn(
                  "rounded-md px-3 py-2 font-display text-xs font-semibold text-muted-foreground transition-colors hover:bg-surface-low hover:text-foreground",
                  period === item.value &&
                    "bg-primary-accent text-primary-foreground hover:bg-primary-accent hover:text-primary-foreground",
                )}
                key={item.value}
                onClick={() => setPeriod(item.value)}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </div>
          <button
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 font-display text-xs font-semibold text-foreground transition-colors hover:bg-surface-low"
            onClick={() => void load()}
            type="button"
          >
            <RefreshCcw aria-hidden className="h-4 w-4" />
            Refresh
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 font-display text-xs font-semibold text-foreground transition-colors hover:bg-surface-low disabled:opacity-50"
            disabled={exporting || !metrics}
            onClick={() => void exportJson()}
            type="button"
          >
            {exporting ? (
              <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
            ) : (
              <Download aria-hidden className="h-4 w-4" />
            )}
            Export JSON
          </button>
        </div>
      </header>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState error={error} onRetry={() => void load()} />
      ) : metrics ? (
        <MetricsDashboard metrics={metrics} />
      ) : null}
    </div>
  );
}

function MetricsDashboard({ metrics }: { metrics: AdminMetricsOverview }) {
  const summaryCards = [
    {
      label: "Visitors",
      value: maybeNumber(metrics.summary.visitors),
      detail: "Umami source",
      icon: Users,
    },
    {
      label: "Signups",
      value: formatNumber(metrics.summary.signups),
      detail: "RoutesPlan DB",
      icon: Sparkles,
    },
    {
      label: "Activated orgs",
      value: formatNumber(metrics.summary.activatedOrganizations),
      detail: "First optimization",
      icon: Activity,
    },
    {
      label: "Completed runs",
      value: formatNumber(metrics.summary.completedOptimizations),
      detail: "Optimization success",
      icon: BarChart3,
    },
    {
      label: "Active orgs",
      value: formatNumber(metrics.summary.activeOrganizations),
      detail: metrics.activeOrganizations.definition,
      icon: Users,
    },
    {
      label: "Success rate",
      value: formatPercent(metrics.summary.optimizationSuccessRate),
      detail: "Completed / all runs",
      icon: Gauge,
    },
    {
      label: "Avg cost / run",
      value: formatMoney(
        metrics.summary.averageVariableCostPerRun,
        metrics.summary.currency,
      ),
      detail: "Estimated variable cost",
      icon: Database,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
        {summaryCards.map((card) => (
          <SummaryCard {...card} key={card.label} />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Section
          description={metrics.funnel.sourceBoundary}
          icon={<MousePointerClick aria-hidden className="h-5 w-5" />}
          title="Primary funnel"
        >
          <Funnel stages={metrics.funnel.stages} />
        </Section>

        <Section
          description="Signup quality and repeat optimization behavior."
          icon={<Sparkles aria-hidden className="h-5 w-5" />}
          title="Activation"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <MetricBlock
              label="Signup -> first optimization"
              value={formatPercent(metrics.activation.signupToFirstOptimizationRate)}
            />
            <MetricBlock
              label="First -> second optimization"
              value={formatPercent(metrics.activation.firstToSecondOptimizationRate)}
            />
            <MetricBlock
              label="Median time to first"
              value={formatDuration(
                metrics.activation.medianSignupToFirstOptimizationSeconds,
              )}
            />
            <MetricBlock
              label="Median time to second"
              value={formatDuration(
                metrics.activation.medianTimeToSecondOptimizationSeconds,
              )}
            />
            <MetricBlock
              label="New users never optimized"
              value={formatNumber(metrics.activation.newUsersWhoNeverOptimized)}
            />
          </div>
        </Section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Section
          description="Retention is anchored on first successful optimization, not signup or page visits."
          icon={<CalendarDays aria-hidden className="h-5 w-5" />}
          title="Retention"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <RetentionCard label="D7 org retention" value={metrics.retention.d7} />
            <RetentionCard label="D30 org retention" value={metrics.retention.d30} />
            <RetentionCard
              label="7-day rolling"
              value={metrics.retention.rolling7}
            />
            <RetentionCard
              label="30-day rolling"
              value={metrics.retention.rolling30}
            />
          </div>
          <DenseMetricGrid
            items={[
              [
                "1 completed optimization",
                metrics.retention.repeatUsage.oneCompletedOptimization,
              ],
              [
                "2+ optimizations",
                metrics.retention.repeatUsage.twoPlusCompletedOptimizations,
              ],
              [
                "5+ optimizations",
                metrics.retention.repeatUsage.fivePlusCompletedOptimizations,
              ],
              [
                "10+ optimizations",
                metrics.retention.repeatUsage.tenPlusCompletedOptimizations,
              ],
              [
                "Median active days / active org 30d",
                metrics.retention.repeatUsage
                  .medianActiveDaysPerActiveOrganization30d,
              ],
            ]}
          />
        </Section>

        <Section
          description="Weekly cohorts use the activation week as the anchor. Immature periods are not treated as 0%."
          icon={<BarChart3 aria-hidden className="h-5 w-5" />}
          title="Retention cohorts"
        >
          <CohortMatrix rows={metrics.retention.weeklyCohorts} />
        </Section>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Section
          description="Usage from product events and optimization records."
          icon={<Activity aria-hidden className="h-5 w-5" />}
          title="Usage"
        >
          <DenseMetricGrid
            items={[
              ["Completed runs", metrics.usage.completedOptimizationRuns],
              ["Runs / active org", metrics.usage.runsPerActiveOrganization],
              [
                "Median runs / org",
                metrics.usage.medianRunsPerActiveOrganization,
              ],
              ["Attachments uploaded", metrics.usage.attachmentsUploaded],
              ["Imported attachments", metrics.usage.attachmentsImported],
              ["PDF exports", metrics.usage.pdfsExported],
              ["PDF export rate", formatPercent(metrics.usage.pdfExportRate)],
            ]}
          />
        </Section>

        <Section
          description="Problem complexity customers are actually sending."
          icon={<BarChart3 aria-hidden className="h-5 w-5" />}
          title="Problem size"
        >
          <DistributionRows
            rows={[
              ["Deliveries", metrics.problemSize.deliveries],
              ["Vehicles", metrics.problemSize.vehicles],
            ]}
          />
        </Section>

        <Section
          description="New and returning optimizer organizations."
          icon={<Users aria-hidden className="h-5 w-5" />}
          title="Active organizations"
        >
          <DenseMetricGrid
            items={[
              ["Active 7d", metrics.activeOrganizations.active7d],
              ["Active 30d", metrics.activeOrganizations.active30d],
              ["Selected period", metrics.activeOrganizations.selectedPeriod],
              ["New active", metrics.activeOrganizations.new],
              ["Returning active", metrics.activeOrganizations.returning],
            ]}
          />
        </Section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Section
          description="Failures are normalized by stage and code, without stack traces."
          icon={<AlertTriangle aria-hidden className="h-5 w-5" />}
          title="Reliability"
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <MetricBlock
              label="Success rate"
              value={formatPercent(metrics.reliability.successRate)}
            />
            <MetricBlock
              label="Failures"
              value={formatNumber(metrics.reliability.totalFailures)}
            />
            <MetricBlock
              label="Failure rate"
              value={formatPercent(metrics.reliability.failureRate)}
            />
          </div>
          <BarList
            emptyLabel="No optimization failures in this period."
            rows={metrics.reliability.failuresByStage}
            title="Failures by stage"
          />
          <BarList
            emptyLabel="No error codes in this period."
            rows={metrics.reliability.commonErrorCodes}
            title="Common error codes"
          />
        </Section>

        <Section
          description="Latency distribution by pipeline area where timings exist."
          icon={<Timer aria-hidden className="h-5 w-5" />}
          title="Performance"
        >
          <DistributionRows
            rows={[
              ["Total", metrics.performance.totalDurationMs],
              ["Geocoding", metrics.performance.geocodingDurationMs],
              ["Matrix", metrics.performance.matrixDurationMs],
              ["Solver", metrics.performance.solverDurationMs],
              ["Geometry", metrics.performance.geometryDurationMs],
            ]}
            suffix="ms"
          />
        </Section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Section
          description="Estimated variable costs plus configured monthly infrastructure."
          icon={<Database aria-hidden className="h-5 w-5" />}
          title="Costs"
        >
          <DenseMetricGrid
            items={[
              [
                "Variable total",
                formatMoney(
                  metrics.costs.total_variable_cost,
                  metrics.costs.currency,
                ),
              ],
              [
                "AI",
                formatMoney(metrics.costs.ai_variable_cost, metrics.costs.currency),
              ],
              [
                "Geoapify",
                formatMoney(
                  metrics.costs.geoapify_variable_cost,
                  metrics.costs.currency,
                ),
              ],
              [
                "Cost / active org",
                formatMoney(
                  metrics.costs.cost_per_active_organization,
                  metrics.costs.currency,
                ),
              ],
              [
                "Monthly infra",
                formatMoney(
                  metrics.costs.estimated_monthly_infrastructure_cost,
                  metrics.costs.currency,
                ),
              ],
              [
                "Estimated monthly total",
                formatMoney(
                  metrics.costs.estimated_total_operating_cost_month,
                  metrics.costs.currency,
                ),
              ],
            ]}
          />
        </Section>

        <Section
          description="Acquisition quality emphasizes actual usage, not vanity signups."
          icon={<MousePointerClick aria-hidden className="h-5 w-5" />}
          title="Acquisition"
        >
          <AcquisitionTable rows={metrics.acquisition} />
        </Section>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Section
          description="Compare describe, upload and example onboarding paths."
          icon={<ArrowDown aria-hidden className="h-5 w-5" />}
          title="Trial path"
        >
          <TrialPathTable rows={metrics.trialPath} />
        </Section>

        <Section
          description="Authentication distribution for friction analysis."
          icon={<Users aria-hidden className="h-5 w-5" />}
          title="Auth methods"
        >
          <BarList emptyLabel="No auth events yet." rows={metrics.authMethods} />
        </Section>

        <Section
          description="Jump to specialized tools for deeper investigation."
          icon={<ExternalLink aria-hidden className="h-5 w-5" />}
          title="External tools"
        >
          <ExternalToolCard tool={metrics.externalTools.umami} />
          <ExternalToolCard tool={metrics.externalTools.openReplay} />
        </Section>
      </div>

      <Section
        description="Anonymized significant events. No emails, customer names, addresses or file names."
        icon={<Activity aria-hidden className="h-5 w-5" />}
        title="Recent activity"
      >
        <RecentActivity rows={metrics.recentActivity} />
      </Section>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex min-h-96 items-center justify-center rounded-lg border border-border bg-card">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Loader2 aria-hidden className="h-5 w-5 animate-spin text-primary-accent" />
        Loading internal metrics
      </div>
    </div>
  );
}

function ErrorState({
  error,
  onRetry,
}: {
  error: AdminMetricsApiError;
  onRetry: () => void;
}) {
  const forbidden = error.statusCode === 403;
  const unauthorized = error.statusCode === 401;
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="flex gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-destructive">
          <ShieldAlert aria-hidden className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-display text-lg font-semibold text-foreground">
            {forbidden
              ? "Internal admin access required"
              : unauthorized
                ? "Sign in required"
                : "Metrics unavailable"}
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
            {error.message}
          </p>
          <button
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 font-display text-xs font-semibold text-foreground transition-colors hover:bg-surface-low"
            onClick={onRetry}
            type="button"
          >
            <RefreshCcw aria-hidden className="h-4 w-4" />
            Retry
          </button>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  detail,
  icon: Icon,
  label,
  value,
}: {
  detail: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase text-muted-foreground">
          {label}
        </p>
        <Icon aria-hidden className="h-4 w-4 text-primary-accent" />
      </div>
      <p className="mt-3 font-display text-2xl font-semibold text-foreground">
        {value}
      </p>
      <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
        {detail}
      </p>
    </div>
  );
}

function Section({
  children,
  description,
  icon,
  title,
}: {
  children: React.ReactNode;
  description: string;
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <div className="mb-5 flex gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-primary-accent">
          {icon}
        </div>
        <div>
          <h2 className="font-display text-lg font-semibold text-foreground">
            {title}
          </h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        </div>
      </div>
      {children}
    </section>
  );
}

function Funnel({ stages }: { stages: FunnelStage[] }) {
  const max = Math.max(1, ...stages.map((stage) => stage.count ?? 0));
  return (
    <div className="space-y-3">
      {stages.map((stage) => (
        <div
          className="grid gap-2 rounded-lg border border-border bg-surface p-3 sm:grid-cols-[minmax(0,1fr)_130px]"
          key={stage.key}
        >
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-display text-sm font-semibold text-foreground">
                {stage.label}
              </p>
              <span className="rounded-sm border border-border bg-card px-2 py-0.5 text-[11px] uppercase text-muted-foreground">
                {stage.source === "umami" ? "Umami" : "DB"}
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-high">
              <div
                className="h-full rounded-full bg-primary-accent"
                style={{
                  width: `${Math.max(4, ((stage.count ?? 0) / max) * 100)}%`,
                }}
              />
            </div>
          </div>
          <div className="text-left sm:text-right">
            <p className="font-display text-lg font-semibold text-foreground">
              {maybeNumber(stage.count)}
            </p>
            <p className="text-xs text-muted-foreground">
              {stage.conversionFromPrevious === null
                ? "source boundary"
                : `${formatPercent(stage.conversionFromPrevious)} from previous`}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function MetricBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <p className="font-display text-xl font-semibold text-foreground">{value}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{label}</p>
    </div>
  );
}

function RetentionCard({
  label,
  value,
}: {
  label: string;
  value: AdminMetricsOverview["retention"]["d7"];
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <p className="font-display text-xl font-semibold text-foreground">
        {value.mature ? formatPercent(value.rate) : "Not mature"}
      </p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        {label} · {value.label}
      </p>
    </div>
  );
}

function CohortMatrix({
  rows,
}: {
  rows: AdminMetricsOverview["retention"]["weeklyCohorts"];
}) {
  if (!rows.length) {
    return <EmptyTable label="No activated cohorts yet." />;
  }

  return (
    <div className="overflow-x-auto scrollbar-soft">
      <table className="w-full min-w-[680px] text-left text-sm">
        <thead className="text-xs uppercase text-muted-foreground">
          <tr className="border-b border-border">
            <th className="py-2 font-semibold">Cohort</th>
            <th className="py-2 font-semibold">Activated</th>
            <th className="py-2 font-semibold">Week 0</th>
            <th className="py-2 font-semibold">Week 1</th>
            <th className="py-2 font-semibold">Week 2</th>
            <th className="py-2 font-semibold">Week 3</th>
            <th className="py-2 font-semibold">Week 4</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr className="border-b border-border last:border-0" key={row.cohortStart}>
              <td className="py-3 font-medium text-foreground">
                {formatShortDate(row.cohortStart)}
              </td>
              <td className="py-3 text-muted-foreground">{row.cohortSize}</td>
              {row.periods.slice(0, 5).map((period) => (
                <td className="py-3 text-muted-foreground" key={period.period}>
                  {period.mature && period.percentage !== null
                    ? `${formatPercent(period.percentage)} (${period.activeCount}/${row.cohortSize})`
                    : "Not mature"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DenseMetricGrid({
  items,
}: {
  items: Array<[string, number | string]>;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {items.map(([label, value]) => (
        <div
          className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2"
          key={label}
        >
          <span className="text-sm text-muted-foreground">{label}</span>
          <span className="font-display text-sm font-semibold text-foreground">
            {typeof value === "number" ? formatNumber(value) : value}
          </span>
        </div>
      ))}
    </div>
  );
}

function DistributionRows({
  rows,
  suffix = "",
}: {
  rows: Array<[string, Distribution]>;
  suffix?: string;
}) {
  return (
    <div className="overflow-x-auto scrollbar-soft">
      <table className="w-full min-w-[420px] text-left text-sm">
        <thead className="text-xs uppercase text-muted-foreground">
          <tr className="border-b border-border">
            <th className="py-2 font-semibold">Metric</th>
            <th className="py-2 font-semibold">Median</th>
            <th className="py-2 font-semibold">Average</th>
            <th className="py-2 font-semibold">P90</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, value]) => (
            <tr className="border-b border-border last:border-0" key={label}>
              <td className="py-3 font-medium text-foreground">{label}</td>
              <td className="py-3 text-muted-foreground">
                {formatNumber(value.median)}
                {suffix}
              </td>
              <td className="py-3 text-muted-foreground">
                {formatNumber(value.average)}
                {suffix}
              </td>
              <td className="py-3 text-muted-foreground">
                {formatNumber(value.p90)}
                {suffix}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BarList({
  emptyLabel,
  rows,
  title,
}: {
  emptyLabel: string;
  rows: CountRow[];
  title?: string;
}) {
  const max = Math.max(1, ...rows.map((row) => row.count));
  return (
    <div className="mt-4 space-y-2">
      {title ? (
        <p className="font-display text-xs font-semibold uppercase text-muted-foreground">
          {title}
        </p>
      ) : null}
      {rows.length ? (
        rows.map((row) => (
          <div className="grid grid-cols-[1fr_auto] items-center gap-3" key={row.key}>
            <div>
              <div className="mb-1 flex items-center justify-between gap-3">
                <span className="truncate text-sm text-foreground">{row.label}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-surface-high">
                <div
                  className="h-full rounded-full bg-primary-accent"
                  style={{ width: `${(row.count / max) * 100}%` }}
                />
              </div>
            </div>
            <span className="font-display text-sm font-semibold text-foreground">
              {formatNumber(row.count)}
            </span>
          </div>
        ))
      ) : (
        <p className="rounded-lg border border-border bg-surface px-3 py-4 text-sm text-muted-foreground">
          {emptyLabel}
        </p>
      )}
    </div>
  );
}

function AcquisitionTable({
  rows,
}: {
  rows: AdminMetricsOverview["acquisition"];
}) {
  if (!rows.length) {
    return <EmptyTable label="No attribution data yet." />;
  }
  return (
    <div className="overflow-x-auto scrollbar-soft">
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead className="text-xs uppercase text-muted-foreground">
          <tr className="border-b border-border">
            <th className="py-2 font-semibold">Source</th>
            <th className="py-2 font-semibold">Visitors</th>
            <th className="py-2 font-semibold">Signups</th>
            <th className="py-2 font-semibold">Activated</th>
            <th className="py-2 font-semibold">Activation %</th>
            <th className="py-2 font-semibold">Second opt.</th>
            <th className="py-2 font-semibold">D7</th>
            <th className="py-2 font-semibold">D30</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr className="border-b border-border last:border-0" key={row.source}>
              <td className="py-3 font-medium text-foreground">{row.source}</td>
              <td className="py-3 text-muted-foreground">
                {row.visitors === null ? "Umami" : row.visitors}
              </td>
              <td className="py-3 text-muted-foreground">{row.signups}</td>
              <td className="py-3 text-muted-foreground">
                {row.firstOptimizations}
              </td>
              <td className="py-3 text-muted-foreground">
                {formatPercent(row.activationRate)} ({row.firstOptimizations}/
                {row.signups})
              </td>
              <td className="py-3 text-muted-foreground">
                {row.secondOptimizations}
              </td>
              <td className="py-3 text-muted-foreground">
                {formatPercent(row.d7RetentionRate)} (
                {row.d7RetainedOrganizations}/{row.activeOrganizations})
              </td>
              <td className="py-3 text-muted-foreground">
                {formatPercent(row.d30RetentionRate)} (
                {row.d30RetainedOrganizations}/{row.activeOrganizations})
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TrialPathTable({ rows }: { rows: AdminMetricsOverview["trialPath"] }) {
  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div className="rounded-lg border border-border bg-surface p-3" key={row.source}>
          <div className="flex items-center justify-between gap-3">
            <p className="font-display text-sm font-semibold capitalize text-foreground">
              {row.source}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatPercent(row.activationRate)} to first opt. ·{" "}
              {formatPercent(row.d7RetentionRate)} D7
            </p>
          </div>
          <div className="mt-3 grid grid-cols-5 gap-2 text-xs">
            <span>{row.trialStarts} starts</span>
            <span>{row.authCompletions} auth</span>
            <span>{row.firstOptimizations} first opt.</span>
            <span>{row.secondOptimizations} second</span>
            <span>{row.d7RetainedOrganizations} D7</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function ExternalToolCard({ tool }: { tool: ExternalToolLink }) {
  return (
    <div className="mb-3 rounded-lg border border-border bg-surface p-4 last:mb-0">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-sm font-semibold text-foreground">
            {tool.label}
          </p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {tool.summary}
          </p>
        </div>
        {tool.url ? (
          <a
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-card px-2 py-1 font-display text-xs font-semibold text-foreground transition-colors hover:bg-surface-low"
            href={tool.url}
            rel="noreferrer"
            target="_blank"
          >
            Open
            <ExternalLink aria-hidden className="h-3.5 w-3.5" />
          </a>
        ) : (
          <span className="rounded-md border border-border bg-card px-2 py-1 text-xs text-muted-foreground">
            No URL
          </span>
        )}
      </div>
    </div>
  );
}

function RecentActivity({
  rows,
}: {
  rows: AdminMetricsOverview["recentActivity"];
}) {
  if (!rows.length) {
    return <EmptyTable label="No significant product events yet." />;
  }
  return (
    <div className="overflow-x-auto scrollbar-soft">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="text-xs uppercase text-muted-foreground">
          <tr className="border-b border-border">
            <th className="py-2 font-semibold">Event</th>
            <th className="py-2 font-semibold">Time</th>
            <th className="py-2 font-semibold">Org</th>
            <th className="py-2 font-semibold">User</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr className="border-b border-border last:border-0" key={row.id}>
              <td className="py-3 font-medium text-foreground">{row.label}</td>
              <td className="py-3 text-muted-foreground">
                {formatDate(row.occurredAt)}
              </td>
              <td className="py-3 text-muted-foreground">
                {row.organizationId ?? "-"}
              </td>
              <td className="py-3 text-muted-foreground">{row.userId ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyTable({ label }: { label: string }) {
  return (
    <p className="rounded-lg border border-border bg-surface px-3 py-4 text-sm text-muted-foreground">
      {label}
    </p>
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

function maybeNumber(value: number | null) {
  return value === null ? "Open Umami" : formatNumber(value);
}

function formatPercent(value: number) {
  return `${Math.round(value * 1000) / 10}%`;
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    currency,
    maximumFractionDigits: value < 1 ? 4 : 2,
    style: "currency",
  }).format(value);
}

function formatDuration(seconds: number | null) {
  if (seconds === null) {
    return "No data";
  }
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }
  if (seconds < 3600) {
    return `${Math.round(seconds / 60)}m`;
  }
  return `${Math.round((seconds / 3600) * 10) / 10}h`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
  }).format(new Date(`${value}T00:00:00Z`));
}
