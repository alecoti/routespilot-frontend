import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { AppShell } from "@/components/app-shell/app-shell";
import { OptimizationStrategySelector } from "@/components/optimization-strategy/optimization-strategy-selector";
import { ConstraintWarning } from "@/components/review/constraint-warning";
import { OptimizationSummary } from "@/components/review/optimization-summary";
import { ProblemPreviewSummary } from "@/components/review/problem-preview-summary";
import { ProblemMetrics } from "@/components/review/problem-metrics";
import { ReviewAccordions } from "@/components/review/review-accordion";
import { ReviewReadinessBadge } from "@/components/review/review-readiness-badge";

export default function ReviewPage() {
  return (
    <AppShell>
      <div className="mx-auto flex min-h-screen max-w-[1440px] flex-col px-4 py-8 md:px-6 md:py-10">
        <header className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-3">
              <h1 className="font-display text-3xl font-semibold text-foreground md:text-4xl">
                Problem preview
              </h1>
              <ReviewReadinessBadge />
            </div>
            <p className="text-lg text-muted-foreground">
              Confirm the route problem before RoutesPilot generates the optimized plan.
            </p>
          </div>
          <Link
            className="inline-flex items-center gap-2 font-display text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            href="/optimize"
          >
            <ArrowLeft aria-hidden className="h-4 w-4" />
            Back to conversation
          </Link>
        </header>

        <ConstraintWarning />

        <div className="flex flex-1 flex-col gap-6 lg:flex-row">
          <section className="w-full lg:w-[65%]">
            <h2 className="mb-6 font-display text-2xl font-medium text-foreground">
              This is what RoutesPilot understood
            </h2>
            <ProblemPreviewSummary />
            <ProblemMetrics />
            <ReviewAccordions />
            <OptimizationStrategySelector />
          </section>

          <section className="w-full lg:w-[35%]">
            <OptimizationSummary />
          </section>
        </div>
      </div>
    </AppShell>
  );
}
