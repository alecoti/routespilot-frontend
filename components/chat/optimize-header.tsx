"use client";

import { useState } from "react";

import { SavedVehicleSelector } from "@/components/settings/saved-vehicle-selector";
import { assessConversationReadiness } from "@/lib/conversation-readiness";
import { renameOptimization, saveOptimizationDraft } from "@/lib/api/history";
import { hasPersistenceContext } from "@/lib/api/persistence-context";
import { getLocationAddress } from "@/lib/locations";
import { cn } from "@/lib/utils";
import { useOptimizationStore } from "@/providers/optimization-provider";

export function OptimizeHeader() {
  const problem = useOptimizationStore((state) => state.problem);
  const optimizationId = useOptimizationStore((state) => state.optimizationId);
  const updateProblem = useOptimizationStore((state) => state.updateProblem);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(problem.name);
  const [savingName, setSavingName] = useState(false);

  const optimizationStatus = useOptimizationStore(
    (state) => state.optimizationStatus,
  );
  const readiness = assessConversationReadiness(problem);
  const issueCount =
    readiness.missingRequirements.length +
    readiness.blockers.length +
    readiness.unresolvedLocations.length;
  const status = optimizationStatus === "optimizing"
    ? "Optimizing"
    : readiness.readyForOptimization
      ? "Ready to optimize"
      : readiness.blockers.length > 0 || readiness.unresolvedLocations.length > 0
        ? "Needs review"
      : issueCount === 1
        ? "Needs 1 detail"
        : issueCount > 1
          ? `Needs ${issueCount} details`
          : "Building plan";
  const summary = buildHeaderSummary({
    depot: getLocationAddress(problem.depot) ?? "",
    stopCount: problem.stops.length,
    vehicleCount: problem.vehicles.length,
  });

  async function saveName() {
    const nextName = normalizeOptimizationName(nameDraft);

    setEditingName(false);
    setNameDraft(nextName);

    if (nextName === problem.name) {
      return;
    }

    updateProblem({ name: nextName });

    if (!optimizationId || !hasPersistenceContext()) {
      return;
    }

    setSavingName(true);

    try {
      await renameOptimization(optimizationId, nextName);
      await saveOptimizationDraft(optimizationId, {
        ...problem,
        name: nextName,
      });
    } catch {
      // Keep the local title responsive; the next autosave/conversation turn
      // will refresh the pending draft snapshot.
    } finally {
      setSavingName(false);
    }
  }

  return (
    <header className="sticky top-16 z-10 border-b border-surface-container bg-card/95 px-6 py-4 backdrop-blur md:top-0 md:px-10">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            {editingName ? (
              <input
                aria-label="Optimization name"
                autoFocus
                className="min-w-0 rounded-md border border-border bg-background px-2 py-1 font-display text-xl font-medium text-foreground outline-none focus:border-primary-accent focus:ring-2 focus:ring-primary-accent/10"
                onBlur={() => void saveName()}
                onChange={(event) => setNameDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.currentTarget.blur();
                  }

                  if (event.key === "Escape") {
                    setNameDraft(problem.name);
                    setEditingName(false);
                  }
                }}
                value={nameDraft}
              />
            ) : (
              <button
                aria-label="Rename optimization"
                className="min-w-0 truncate rounded-md text-left font-display text-xl font-medium text-foreground outline-none transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-primary-accent/20"
                onClick={() => {
                  setNameDraft(problem.name);
                  setEditingName(true);
                }}
                type="button"
              >
                {problem.name || "New optimization"}
              </button>
            )}
            <span
              className={cn(
                "shrink-0 rounded-full border px-3 py-1 font-display text-xs font-medium",
                readiness.readyForOptimization
                  ? "border-primary-accent/30 bg-primary-accent/10 text-primary"
                  : "border-border bg-surface-low text-muted-foreground",
              )}
            >
              {status}
            </span>
            {savingName ? (
              <span className="text-xs text-muted-foreground">Saving...</span>
            ) : null}
          </div>
          <p className="mt-1 truncate text-sm text-muted-foreground">
            {summary}
          </p>
        </div>
        <div className="hidden shrink-0 md:block">
          <SavedVehicleSelector />
        </div>
      </div>
    </header>
  );
}

function normalizeOptimizationName(value: string) {
  return value.trim() || "New optimization";
}

function buildHeaderSummary({
  depot,
  stopCount,
  vehicleCount,
}: {
  depot: string;
  stopCount: number;
  vehicleCount: number;
}) {
  const parts = [
    stopCount > 0 ? `${stopCount} deliveries` : null,
    vehicleCount > 0 ? `${vehicleCount} vehicles` : null,
    depot ? shortDepot(depot) : null,
  ].filter(Boolean);

  return parts.length > 0
    ? parts.join(" · ")
    : "Upload a deliveries file or describe the plan in your own words.";
}

function shortDepot(depot: string) {
  return depot.split(",").slice(0, 2).join(",").trim();
}
