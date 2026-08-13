"use client";

import { AlertTriangle } from "lucide-react";

import { formatTimeWindow } from "@/lib/formatters";
import { useOptimizationStore } from "@/providers/optimization-provider";

export function ConstraintWarning() {
  const warningStop = useOptimizationStore((state) =>
    state.problem.stops.find((stop) => stop.timeWindow),
  );

  if (!warningStop) {
    return null;
  }

  return (
    <div className="mb-8 flex flex-col gap-4 rounded-lg border border-warning-border bg-warning-bg p-4 sm:flex-row sm:items-start">
      <AlertTriangle
        aria-hidden
        className="mt-0.5 h-5 w-5 shrink-0 text-amber-600"
      />
      <div className="flex-1">
        <h2 className="font-display text-sm font-semibold text-warning-text">
          Constraint Warning
        </h2>
        <p className="mt-1 text-sm leading-6 text-amber-700">
          Narrow delivery window: {warningStop.name} (
          {formatTimeWindow(warningStop.timeWindow)}). This may make the route
          difficult to optimize.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <button className="font-display text-xs font-semibold text-warning-text">
          Edit
        </button>
        <button className="rounded-md border border-amber-300 bg-amber-100 px-3 py-1.5 font-display text-xs font-semibold text-warning-text">
          Keep constraint
        </button>
      </div>
    </div>
  );
}
