"use client";

import { useCallback, useEffect, useState } from "react";
import { BarChart3, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";

import {
  getOrganizationEntitlements,
  type OrganizationEntitlements,
  type UsageLimitStatus,
} from "@/lib/api/entitlements";
import {
  getUsageSummary,
  type UsageSummary,
} from "@/lib/api/organization-config";
import { hasPersistenceContext } from "@/lib/api/persistence-context";
import { cn } from "@/lib/utils";

export function UsagePageContent() {
  const persistenceConfigured = hasPersistenceContext();
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [entitlements, setEntitlements] =
    useState<OrganizationEntitlements | null>(null);
  const [loading, setLoading] = useState(persistenceConfigured);
  const [error, setError] = useState<string | null>(null);

  const loadUsage = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [usagePayload, entitlementPayload] = await Promise.all([
        getUsageSummary(),
        getOrganizationEntitlements(),
      ]);

      setUsage(usagePayload);
      setEntitlements(entitlementPayload);
    } catch {
      setError("We couldn't load usage details.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!persistenceConfigured) {
      return;
    }

    const timeout = window.setTimeout(() => {
      void loadUsage();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [loadUsage, persistenceConfigured]);

  if (!persistenceConfigured) {
    return (
      <UsageShell>
        <div className="rounded-lg border border-border bg-card p-6">
          <SectionHeading
            description="Usage requires an organization context."
            icon={<BarChart3 aria-hidden className="h-5 w-5" />}
            title="Usage unavailable"
          />
          <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">
            Configure the demo organization and user IDs to view monthly usage,
            limits and access details.
          </p>
        </div>
      </UsageShell>
    );
  }

  return (
    <UsageShell>
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex min-h-80 items-center justify-center rounded-lg border border-border bg-card">
          <Loader2
            aria-hidden
            className="h-5 w-5 animate-spin text-primary-accent"
          />
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <section className="rounded-lg border border-border bg-card p-5">
            <SectionHeading
              description="Current access and product limits for this organization."
              icon={<ShieldCheck aria-hidden className="h-5 w-5" />}
              title="Plan"
            />

            <div className="mt-5 grid gap-4">
              <div className="rounded-lg border border-border bg-surface p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-display text-xl font-semibold text-foreground">
                      {entitlements?.planLabel ?? "Plan unavailable"}
                    </p>
                    <p className="mt-1 text-xs uppercase text-muted-foreground">
                      {entitlements
                        ? `${titleCase(entitlements.subscriptionStatus)} | ${titleCase(entitlements.accessState)} access`
                        : "Entitlements unavailable"}
                    </p>
                  </div>
                  <span className="rounded-lg border border-primary-accent/25 bg-primary-accent/10 px-3 py-1 font-display text-xs font-semibold text-primary-accent">
                    {entitlements?.planCode ?? "unknown"}
                  </span>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <PlanLimit
                  label="Optimizations this month"
                  status={entitlements?.usage.optimizations}
                />
                <PlanLimit
                  label="Stops this month"
                  status={entitlements?.usage.stops}
                />
                <PlanLimit
                  label="Comparisons this month"
                  status={entitlements?.usage.comparisons}
                />
                <PlanLimit
                  label="AI extractions this month"
                  status={entitlements?.usage.aiExtractions}
                />
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-5">
            <SectionHeading
              description="Measured product activity for the current organization month."
              icon={<BarChart3 aria-hidden className="h-5 w-5" />}
              title="Monthly usage"
            />

            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <UsageMetric
                label="Optimizations"
                value={usage?.optimizations ?? 0}
              />
              <UsageMetric
                label="Stops optimized"
                value={usage?.stopsOptimized ?? 0}
              />
              <UsageMetric
                label="Comparisons"
                value={usage?.comparisons ?? 0}
              />
              <UsageMetric label="Exports" value={usage?.exports ?? 0} />
              <UsageMetric
                label="AI extractions"
                value={usage?.aiExtractions ?? 0}
              />
              <UsageMetric
                label="Completed"
                value={usage?.optimizationsCompleted ?? 0}
              />
            </div>
            <p className="mt-4 text-xs leading-5 text-muted-foreground">
              {usage
                ? `${usage.period.start} to ${usage.period.end} | ${usage.period.timezone}`
                : "Usage totals are unavailable."}
            </p>
          </section>

          <section className="rounded-lg border border-border bg-card p-5 xl:col-span-2">
            <SectionHeading
              description="Capabilities currently available to this organization."
              icon={<CheckCircle2 aria-hidden className="h-5 w-5" />}
              title="Access"
            />

            <div className="mt-5 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
              <CapabilityRow
                enabled={Boolean(entitlements?.capabilities.canComparePlans)}
                label="Comparative plans"
              />
              <CapabilityRow
                enabled={Boolean(
                  entitlements?.capabilities.canUseAdvancedStrategy,
                )}
                label="Custom strategies"
              />
              <CapabilityRow
                enabled={Boolean(entitlements?.capabilities.canUseSavedLocations)}
                label="Saved locations"
              />
              <CapabilityRow
                enabled={Boolean(
                  entitlements?.capabilities.canUseSavedVehicleTemplates,
                )}
                label="Saved vehicle templates"
              />
            </div>
          </section>
        </div>
      )}
    </UsageShell>
  );
}

function UsageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 py-8 md:px-8">
      <header>
        <p className="font-display text-xs font-semibold uppercase text-primary-accent">
          Usage
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold text-foreground">
          Usage and limits
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Monitor monthly activity, access state and quota consumption for the
          current organization.
        </p>
      </header>
      {children}
    </div>
  );
}

function SectionHeading({
  description,
  icon,
  title,
}: {
  description: string;
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <div className="flex gap-3">
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
  );
}

function UsageMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <p className="font-display text-2xl font-semibold text-foreground">
        {new Intl.NumberFormat("en-US").format(value)}
      </p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{label}</p>
    </div>
  );
}

function PlanLimit({
  label,
  status,
}: {
  label: string;
  status?: UsageLimitStatus;
}) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <p className="font-display text-lg font-semibold text-foreground">
        {status ? formatLimit(status.used, status.limit) : "Unavailable"}
      </p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{label}</p>
    </div>
  );
}

function CapabilityRow({
  enabled,
  label,
}: {
  enabled: boolean;
  label: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2">
      <span>{label}</span>
      <span
        className={cn(
          "font-display text-xs font-semibold",
          enabled ? "text-primary-accent" : "text-muted-foreground",
        )}
      >
        {enabled ? "Included" : "Not included"}
      </span>
    </div>
  );
}

function formatLimit(used: number, limit?: number | null) {
  const formattedUsed = new Intl.NumberFormat("en-US").format(used);

  if (limit === null || typeof limit === "undefined") {
    return `${formattedUsed} / unlimited`;
  }

  return `${formattedUsed} / ${new Intl.NumberFormat("en-US").format(limit)}`;
}

function titleCase(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
