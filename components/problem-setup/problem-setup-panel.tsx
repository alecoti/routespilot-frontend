"use client";

import { useEffect, useMemo } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Clock3,
  FileSpreadsheet,
  ListChecks,
  MapPin,
  PackageCheck,
  SlidersHorizontal,
  Truck,
  XCircle,
} from "lucide-react";
import Link from "next/link";

import { assessConversationReadiness } from "@/lib/conversation-readiness";
import {
  buildProblemSidebarSections,
  buildSidebarSyncSnapshot,
  type SidebarSectionIconKey,
  type SidebarSectionModel,
  type SidebarSectionStatus,
} from "@/lib/problem-sidebar-model";
import { cn } from "@/lib/utils";
import { useOptimizationStore } from "@/providers/optimization-provider";

const sectionIcons: Record<
  SidebarSectionIconKey,
  React.ComponentType<{ className?: string; strokeWidth?: number }>
> = {
  constraints: Clock3,
  deliveries: PackageCheck,
  files: FileSpreadsheet,
  optimization: SlidersHorizontal,
  route: MapPin,
  vehicles: Truck,
};

export function ProblemSetupPanel() {
  const problem = useOptimizationStore((state) => state.problem);
  const importedFile = useOptimizationStore((state) => state.importedFile);
  const conversationRevision = useOptimizationStore(
    (state) => state.conversationRevision,
  );
  const readiness = assessConversationReadiness(problem);
  const sections = buildProblemSidebarSections({ importedFile, problem });
  const sidebarSnapshot = useMemo(() => buildSidebarSyncSnapshot(problem), [problem]);
  const canonicalSnapshot = sidebarSnapshot;
  const issueCount =
    readiness.missingRequirements.length +
    readiness.blockers.length +
    readiness.unresolvedLocations.length;
  const firstIssue =
    readiness.missingRequirements[0] ??
    readiness.blockers[0] ??
    readiness.unresolvedLocations[0];
  const readySectionCount = sections.filter(
    (section) => section.status === "complete",
  ).length;

  useEffect(() => {
    if (process.env.NODE_ENV === "production") {
      return;
    }

    const mismatch =
      canonicalSnapshot.depot !== sidebarSnapshot.depot ||
      canonicalSnapshot.vehicles !== sidebarSnapshot.vehicles ||
      canonicalSnapshot.stops !== sidebarSnapshot.stops ||
      canonicalSnapshot.strategy !== sidebarSnapshot.strategy;

    console.info("[SIDEBAR SYNC]", {
      revision: conversationRevision,
      canonical: canonicalSnapshot,
      sidebarSelector: sidebarSnapshot,
    });

    if (mismatch) {
      console.warn("SIDEBAR_STATE_MISMATCH", {
        canonical: canonicalSnapshot,
        sidebarSelector: sidebarSnapshot,
      });
    }
  }, [canonicalSnapshot, conversationRevision, sidebarSnapshot]);

  return (
    <aside className="flex min-h-[520px] flex-col border-t border-border bg-surface lg:min-h-0 lg:w-[420px] lg:shrink-0 lg:border-l lg:border-t-0">
      <div className="border-b border-border px-6 py-5">
        <h3 className="font-display text-xs font-semibold uppercase text-muted-foreground">
          Route plan
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {readySectionCount} of {sections.length} sections ready
        </p>
      </div>

      <div className="scrollbar-soft flex-1 overflow-y-auto">
        {sections.map((section) => (
          <PlanSection key={section.label} section={section} />
        ))}
      </div>

      <div className="border-t border-border bg-surface px-6 py-5">
        <div className="flex items-start gap-3">
          {readiness.readyForOptimization ? (
            <CheckCircle2
              aria-hidden
              className="mt-0.5 h-5 w-5 shrink-0 text-primary-accent"
              strokeWidth={1.8}
            />
          ) : issueCount > 0 ? (
            <AlertTriangle
              aria-hidden
              className="mt-0.5 h-5 w-5 shrink-0 text-amber-500"
              strokeWidth={1.8}
            />
          ) : (
            <ListChecks
              aria-hidden
              className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground"
              strokeWidth={1.8}
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="font-display text-sm font-medium text-foreground">
              {readiness.readyForOptimization
                ? "Ready to optimize"
                : issueCount === 1
                  ? "1 detail needs attention"
                  : `${issueCount} details need attention`}
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {readiness.readyForOptimization
                ? `${problem.stops.length} deliveries · ${problem.vehicles.length} vehicles`
                : firstIssue?.message ?? "Add the missing route details."}
            </p>
            <Link
              className={cn(
                "mt-4 inline-flex w-full items-center justify-center rounded-full px-4 py-2 font-display text-sm font-medium transition-opacity hover:opacity-90",
                readiness.readyForOptimization
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-card text-foreground",
              )}
              href={readiness.readyForOptimization ? "/review" : "/optimize"}
            >
              {readiness.readyForOptimization ? "Problem preview" : "Review details"}
            </Link>
          </div>
        </div>
      </div>
    </aside>
  );
}

function PlanSection({ section }: { section: SidebarSectionModel }) {
  const Icon = sectionIcons[section.iconKey];

  return (
    <section className="border-b border-border px-6 py-4 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Icon
              aria-hidden
              className="h-4 w-4 shrink-0 text-muted-foreground"
              strokeWidth={1.8}
            />
            <p className="font-display text-xs font-semibold uppercase text-muted-foreground">
              {section.label}
            </p>
          </div>
          <p
            className={cn(
              "mt-2 text-sm font-medium leading-5",
              section.status === "complete"
                ? "text-foreground"
                : "text-muted-foreground",
            )}
          >
            {section.summary}
          </p>
        </div>
        <StatusIcon status={section.status} />
      </div>
      {section.details.length > 0 ? (
        <div className="mt-3 space-y-1.5 pl-6">
          {section.details.map((detail) => (
            <p
              className="break-words text-xs leading-5 text-muted-foreground"
              key={detail}
            >
              {detail}
            </p>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function StatusIcon({ status }: { status: SidebarSectionStatus }) {
  if (status === "complete") {
    return (
      <span aria-label="Complete" title="Complete">
        <CheckCircle2
          aria-hidden
          className="h-5 w-5 shrink-0 text-primary-accent"
          strokeWidth={1.8}
        />
      </span>
    );
  }

  if (status === "warning") {
    return (
      <span aria-label="Needs review" title="Needs review">
        <AlertTriangle
          aria-hidden
          className="h-5 w-5 shrink-0 text-amber-500"
          strokeWidth={1.8}
        />
      </span>
    );
  }

  if (status === "error") {
    return (
      <span aria-label="Error" title="Error">
        <XCircle
          aria-hidden
          className="h-5 w-5 shrink-0 text-destructive"
          strokeWidth={1.8}
        />
      </span>
    );
  }

  return (
    <span aria-label="Incomplete" title="Incomplete">
      <Circle
        aria-hidden
        className="h-5 w-5 shrink-0 text-muted-foreground/50"
        strokeWidth={1.8}
      />
    </span>
  );
}
