"use client";

import { FormEvent, useState } from "react";

import { defaultCapacityDimension, vehicleCapacityValue } from "@/lib/capacity";
import type { ConversationQuestion } from "@/lib/conversation-types";
import { useOptimizationStore } from "@/providers/optimization-provider";

export function VehicleCapacitiesQuestion({
  question,
}: {
  question: ConversationQuestion;
}) {
  const vehicles = useOptimizationStore((state) => state.problem.vehicles);
  const answerConversationQuestion = useOptimizationStore(
    (state) => state.answerConversationQuestion,
  );
  const capacityDimensions = question.capacityDimensions?.length
    ? question.capacityDimensions
    : [defaultCapacityDimension];
  const visibleVehicleIds = new Set(
    question.missingVehicleCapacityIds?.length
      ? question.missingVehicleCapacityIds
      : vehicles.map((vehicle) => vehicle.id),
  );
  const visibleVehicles = vehicles.filter((vehicle) =>
    visibleVehicleIds.has(vehicle.id),
  );
  const [values, setValues] = useState(() =>
    Object.fromEntries(
      visibleVehicles.flatMap((vehicle) =>
        capacityDimensions.map((dimension) => [
          inputKey(vehicle.id, dimension.key),
          String(vehicleCapacityValue(vehicle, dimension.key) ?? ""),
        ]),
      ),
    ),
  );
  const capacities = visibleVehicles.flatMap((vehicle) =>
    capacityDimensions.map((dimension) => ({
      vehicleId: vehicle.id,
      vehicleName: vehicle.name,
      dimensionKey: dimension.key,
      capacity: Number(values[inputKey(vehicle.id, dimension.key)]),
    })),
  );
  const isValid = capacities.every(
    (item) => Number.isFinite(item.capacity) && item.capacity > 0,
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isValid) {
      return;
    }

    answerConversationQuestion(question, capacities);
  }

  return (
    <form
      className="max-w-sm rounded-xl border border-surface-highest bg-card p-5"
      onSubmit={handleSubmit}
    >
      <div className="flex flex-col gap-3">
        {visibleVehicles.map((vehicle) => (
          <div className="grid gap-2" key={vehicle.id}>
            <p className="font-display text-sm font-medium text-foreground">
              {vehicle.name}
            </p>
            {capacityDimensions.map((dimension) => (
              <label
                className="flex items-center justify-between gap-4"
                key={`${vehicle.id}-${dimension.key}`}
              >
                <span className="w-20 font-display text-xs font-medium text-muted-foreground">
                  {dimension.label}
                </span>
                <span className="flex flex-1 items-center gap-2">
                  <input
                    aria-label={`${vehicle.name} ${dimension.label} capacity`}
                    className="w-full rounded-md border border-border bg-surface px-3 py-2 text-right text-sm text-foreground outline-none focus:border-primary-accent focus:ring-2 focus:ring-primary-accent/10"
                    inputMode="numeric"
                    min={1}
                    onChange={(event) =>
                      setValues((current) => ({
                        ...current,
                        [inputKey(vehicle.id, dimension.key)]: event.target.value,
                      }))
                    }
                    step={dimension.key === "pallets" || dimension.key === "packages" ? 1 : "any"}
                    type="number"
                    value={values[inputKey(vehicle.id, dimension.key)] ?? ""}
                  />
                  <span className="min-w-8 font-display text-sm font-medium text-muted-foreground">
                    {dimension.unit}
                  </span>
                </span>
              </label>
            ))}
          </div>
        ))}
      </div>
      <button
        className="mt-5 w-full rounded-lg bg-foreground py-2.5 font-display text-sm font-medium text-card transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        disabled={!isValid}
        type="submit"
      >
        Confirm
      </button>
    </form>
  );
}

function inputKey(vehicleId: string, dimensionKey: string) {
  return `${vehicleId}:${dimensionKey}`;
}
