"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, Truck } from "lucide-react";

import {
  listVehicleTemplates,
  type VehicleTemplate,
} from "@/lib/api/organization-config";
import { hasPersistenceContext } from "@/lib/api/persistence-context";
import type { CapacityDimensionDefinition, Vehicle } from "@/lib/types";
import { useOptimizationStore } from "@/providers/optimization-provider";

export function SavedVehicleSelector() {
  const persistenceConfigured = hasPersistenceContext();
  const problem = useOptimizationStore((state) => state.problem);
  const updateProblem = useOptimizationStore((state) => state.updateProblem);
  const [templates, setTemplates] = useState<VehicleTemplate[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(persistenceConfigured);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!persistenceConfigured) {
      return;
    }

    async function loadTemplates() {
      setLoading(true);

      try {
        setTemplates(await listVehicleTemplates(false));
      } catch {
        setError("Saved vehicles are unavailable.");
      } finally {
        setLoading(false);
      }
    }

    void loadTemplates();
  }, [persistenceConfigured]);

  const availableTemplates = useMemo(
    () =>
      templates.filter(
        (template) =>
          !problem.vehicles.some((vehicle) => vehicle.id === vehicleId(template)),
      ),
    [problem.vehicles, templates],
  );

  if (!persistenceConfigured || (loading && templates.length === 0)) {
    return null;
  }

  if (error || availableTemplates.length === 0) {
    return null;
  }

  function applySelectedVehicles() {
    const selectedTemplates = availableTemplates.filter((template) =>
      selectedIds.includes(template.id),
    );

    if (selectedTemplates.length === 0) {
      return;
    }

    updateProblem({
      vehicles: [
        ...problem.vehicles,
        ...selectedTemplates.map(templateToVehicle),
      ],
      capacityDimensions: mergeDimensions(
        problem.capacityDimensions ?? [],
        selectedTemplates.flatMap((template) => template.capacityDimensions),
      ),
    });
    setSelectedIds([]);
  }

  return (
    <section className="mx-auto mt-5 max-w-3xl rounded-lg border border-border bg-surface p-4 text-left">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-primary-accent">
          <Truck aria-hidden className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-semibold text-foreground">
            Use saved vehicles
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {availableTemplates.map((template) => (
              <label
                className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
                key={template.id}
              >
                <input
                  checked={selectedIds.includes(template.id)}
                  className="h-4 w-4 accent-primary-accent"
                  onChange={(event) =>
                    setSelectedIds((current) =>
                      event.target.checked
                        ? [...current, template.id]
                        : current.filter((id) => id !== template.id),
                    )
                  }
                  type="checkbox"
                />
                {template.name}
              </label>
            ))}
            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary-accent px-3 font-display text-sm font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
              disabled={selectedIds.length === 0}
              onClick={applySelectedVehicles}
              type="button"
            >
              {loading ? (
                <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
              ) : (
                <Check aria-hidden className="h-4 w-4" />
              )}
              Add
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function templateToVehicle(template: VehicleTemplate): Vehicle {
  return {
    id: vehicleId(template),
    name: template.name,
    capacities: { ...template.capacities },
    operatingCost: template.operatingCost
      ? { ...template.operatingCost }
      : undefined,
  };
}

function vehicleId(template: VehicleTemplate) {
  return `vehicle-${template.id}`;
}

function mergeDimensions(
  existing: CapacityDimensionDefinition[],
  incoming: CapacityDimensionDefinition[],
) {
  const byKey = new Map(existing.map((dimension) => [dimension.key, dimension]));

  for (const dimension of incoming) {
    if (!byKey.has(dimension.key)) {
      byKey.set(dimension.key, dimension);
    }
  }

  return Array.from(byKey.values());
}
