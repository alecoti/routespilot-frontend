"use client";

import { CheckCircle2 } from "lucide-react";

import {
  presetOptions,
  type PresetDefinition,
} from "@/lib/optimization-strategy";
import { cn } from "@/lib/utils";
import type { OptimizationPreset } from "@/lib/types";

export function PresetSelector({
  isFeatureAvailable = () => true,
  onSelect,
  selectedPreset,
}: {
  isFeatureAvailable?: (preset: PresetDefinition) => boolean;
  onSelect: (preset: OptimizationPreset) => void;
  selectedPreset?: OptimizationPreset;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {presetOptions.map((preset) => {
        const selected = selectedPreset === preset.id;
        const available = isFeatureAvailable(preset);

        return (
          <button
            className={cn(
              "flex min-h-28 w-full items-start gap-3 rounded-lg border bg-surface p-4 text-left transition-colors hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-50",
              selected
                ? "border-2 border-primary-accent bg-primary-accent/5"
                : "border-border",
            )}
            disabled={!available}
            key={preset.id}
            onClick={() => onSelect(preset.id)}
            type="button"
          >
            <span
              className={cn(
                "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                selected
                  ? "border-primary-accent bg-primary-accent text-primary-foreground"
                  : "border-border",
              )}
            >
              {selected ? <CheckCircle2 aria-hidden className="h-4 w-4" /> : null}
            </span>
            <span className="min-w-0">
              <span className="block font-display text-sm font-semibold text-foreground">
                {preset.label}
              </span>
              <span className="mt-1 block text-sm leading-5 text-muted-foreground">
                {preset.description}
              </span>
              {!preset.supportedByCurrentSolver ? (
                <span className="mt-2 inline-flex rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 font-display text-xs font-medium text-amber-800">
                  Engine v2
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
