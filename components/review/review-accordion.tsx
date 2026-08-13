"use client";

import { useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  LocateFixed,
  Route,
  Store,
  Truck,
} from "lucide-react";

import {
  builtInCapacityDimensions,
  formatCapacityValue,
  formatStopDemands,
  getCapacityDimensions,
  vehicleCapacityValue,
  withVehicleCapacity,
} from "@/lib/capacity";
import {
  formatDeliveryPriority,
  formatMoneyMinor,
  formatServicePolicy,
  formatTimeWindow,
  formatTimeWindowMode,
} from "@/lib/formatters";
import { formatLocationAddress } from "@/lib/locations";
import { getEffectiveOptimizationStrategy } from "@/lib/optimization-strategy";
import {
  routeLocationsForProblem,
  routeStopActionLabel,
} from "@/lib/routing-locations";
import type {
  DeliveryPriority,
  ServicePolicy,
  TimeWindowMode,
  CapacityDimensionDefinition,
  Vehicle,
  VehicleOperatingCost,
} from "@/lib/types";
import { useOptimizationStore } from "@/providers/optimization-provider";

const priorityOptions: DeliveryPriority[] = ["critical", "high", "normal", "low"];
const servicePolicyOptions: ServicePolicy[] = ["required", "preferred", "optional"];
const windowModeOptions: TimeWindowMode[] = ["hard", "soft"];

export function ReviewAccordions() {
  const problem = useOptimizationStore((state) => state.problem);
  const depot = useOptimizationStore((state) => state.problem.depot);
  const returnToDepot = useOptimizationStore(
    (state) => state.problem.returnToDepot,
  );
  const stops = useOptimizationStore((state) => state.problem.stops);
  const setStops = useOptimizationStore((state) => state.setStops);
  const setVehicles = useOptimizationStore((state) => state.setVehicles);
  const updateProblem = useOptimizationStore((state) => state.updateProblem);
  const updateVehicle = useOptimizationStore((state) => state.updateVehicle);
  const vehicles = useOptimizationStore((state) => state.problem.vehicles);
  const currency = problem.currency ?? "EUR";
  const strategy = getEffectiveOptimizationStrategy(problem);
  const capacityDimensions = getCapacityDimensions(problem);
  const routeLocations = routeLocationsForProblem(problem);
  const pickupDeliveryJobCount = (problem.jobs ?? []).filter(
    (job) => job.type === "pickup_delivery",
  ).length;
  const deliveryJobCount = routeLocations.filter(
    (location) => location.role === "delivery",
  ).length;
  const timeWindowCount = routeLocations.filter((stop) => stop.timeWindow).length;
  const [bulkPriority, setBulkPriority] = useState<DeliveryPriority>("normal");
  const [bulkServicePolicy, setBulkServicePolicy] =
    useState<ServicePolicy>("required");
  const [bulkWindowMode, setBulkWindowMode] = useState<TimeWindowMode>("hard");
  const [bulkMaxLateness, setBulkMaxLateness] = useState(30);
  const [bulkCost, setBulkCost] = useState<VehicleOperatingCost>({
    fixedCost: 40,
    costPerKm: 0.3,
    costPerHour: 20,
    overtimeAfterMinutes: 480,
    overtimeCostPerHour: 15,
  });
  const requirementCounts = countBy(routeLocations.map((stop) => stop.servicePolicy ?? "required"));
  const flexibleWindowCount = routeLocations.filter(
    (stop) => stop.timeWindow?.mode === "soft",
  ).length;
  const costOptimizationActive = Boolean(
    strategy?.objectives.some(
      (objective) =>
        objective.enabled && objective.type === "minimize_operating_cost",
    ),
  );
  const vehiclesWithCostCount = vehicles.filter((vehicle) =>
    hasOperatingCostModel(vehicle.operatingCost),
  ).length;

  function applyBulkDeliverySettings() {
    setStops(
      stops.map((stop) => ({
        ...stop,
        priority: bulkPriority,
        servicePolicy: bulkServicePolicy,
        timeWindow: stop.timeWindow
          ? {
              ...stop.timeWindow,
              mode: bulkWindowMode,
              maxLatenessMinutes:
                bulkWindowMode === "soft" ? bulkMaxLateness : undefined,
            }
          : stop.timeWindow,
      })),
    );
  }

  function applyBulkVehicleCosts() {
    setVehicles(
      vehicles.map((vehicle) => ({
        ...vehicle,
        operatingCost: compactOperatingCost({
          ...vehicle.operatingCost,
          ...bulkCost,
        }),
      })),
    );
  }

  function updateVehicleCost(vehicleId: string, patch: VehicleOperatingCost) {
    const vehicle = vehicles.find((item) => item.id === vehicleId);

    updateVehicle(vehicleId, {
      operatingCost: compactOperatingCost({
        ...vehicle?.operatingCost,
        ...patch,
      }),
    });
  }

  function addCapacityDimension(dimension: CapacityDimensionDefinition) {
    const currentDimensions = capacityDimensions;

    if (currentDimensions.some((item) => item.key === dimension.key)) {
      return;
    }

    updateProblem({
      capacityDimensions: [...currentDimensions, dimension],
    });
  }

  function updateVehicleCapacity(
    vehicleId: string,
    dimensionKey: string,
    value: number | undefined,
  ) {
    const vehicle = vehicles.find((item) => item.id === vehicleId);

    if (!vehicle) {
      return;
    }

    updateVehicle(vehicleId, withVehicleCapacity(vehicle, dimensionKey, value));
  }

  return (
    <div className="mb-12 flex flex-col gap-3">
      <details className="group rounded-lg border border-border bg-surface">
        <summary className="flex cursor-pointer list-none items-center justify-between p-4">
          <span className="flex items-center gap-3 font-display text-sm font-semibold text-foreground">
            <LocateFixed
              aria-hidden
              className="h-5 w-5 text-muted-foreground"
              strokeWidth={1.8}
            />
            Operations
          </span>
          <ChevronDown
            aria-hidden
            className="h-5 w-5 text-muted-foreground transition-transform group-open:rotate-180"
          />
        </summary>
        <div className="border-t border-border bg-card p-4">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div className="flex items-start gap-2 text-sm text-foreground">
              <Store
                aria-hidden
                className="mt-0.5 h-4 w-4 text-muted-foreground"
              />
              <p>
                <span className="font-medium">Depot:</span>{" "}
                {formatLocationAddress(depot)}
              </p>
            </div>
            <a className="font-display text-xs font-semibold text-primary-accent" href="#">
              Edit operations
            </a>
          </div>
          <div className="mb-4 grid gap-3 rounded-md border border-border bg-surface-low p-3 text-sm md:grid-cols-3">
            <SummaryPill
              label="Operations"
              value={`${deliveryJobCount} deliveries | ${pickupDeliveryJobCount} pickup & delivery`}
            />
            <SummaryPill
              label="Requirements"
              value={`${requirementCounts.required ?? 0} required | ${
                requirementCounts.preferred ?? 0
              } preferred | ${requirementCounts.optional ?? 0} optional`}
            />
            <SummaryPill
              label="Flexible windows"
              value={String(flexibleWindowCount)}
            />
          </div>
          <details className="mb-4 rounded-md border border-border bg-surface-low">
            <summary className="cursor-pointer list-none px-3 py-2 font-display text-xs font-semibold uppercase text-muted-foreground">
              Advanced delivery settings
            </summary>
            <div className="grid gap-3 border-t border-border p-3 md:grid-cols-5">
              <ControlSelect
                label="Priority"
                onChange={(value) => setBulkPriority(value as DeliveryPriority)}
                options={priorityOptions}
                value={bulkPriority}
              />
              <ControlSelect
                label="Requirement"
                onChange={(value) => setBulkServicePolicy(value as ServicePolicy)}
                options={servicePolicyOptions}
                value={bulkServicePolicy}
              />
              <ControlSelect
                label="Window behavior"
                onChange={(value) => setBulkWindowMode(value as TimeWindowMode)}
                options={windowModeOptions}
                value={bulkWindowMode}
              />
              <label className="flex flex-col gap-1">
                <span className="font-display text-xs font-medium text-muted-foreground">
                  Max lateness
                </span>
                <input
                  className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary-accent"
                  min={0}
                  onChange={(event) =>
                    setBulkMaxLateness(Number(event.target.value) || 0)
                  }
                  type="number"
                  value={bulkMaxLateness}
                />
              </label>
              <button
                className="self-end rounded-lg border border-border bg-card px-3 py-2 font-display text-xs font-semibold text-foreground transition-colors hover:bg-surface"
                onClick={applyBulkDeliverySettings}
                type="button"
              >
                Apply to deliveries
              </button>
            </div>
          </details>
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full min-w-[760px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-low">
                  {["Action", "Customer", "Address", "Load", "Window", "Priority", "Requirement"].map((head) => (
                    <th
                      className="px-3 py-2 font-display text-xs font-semibold text-muted-foreground"
                      key={head}
                    >
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {routeLocations.slice(0, 4).map((stop) => {
                  const window = formatTimeWindow(stop.timeWindow);

                  return (
                  <tr
                    className="border-b border-border last:border-b-0 hover:bg-surface-low"
                    key={stop.id}
                  >
                    <td className="px-3 py-2 text-muted-foreground">
                      {routeStopActionLabel(stop.role)}
                    </td>
                    <td className="px-3 py-2 font-medium text-foreground">
                      {stop.name}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {stop.address}
                    </td>
                    <td className="px-3 py-2 text-right text-foreground">
                      {formatStopDemands(stop, capacityDimensions)}
                    </td>
                    <td className="px-3 py-2">
                      {stop.timeWindow ? (
                        <span className="rounded border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-900">
                          {window} | {formatTimeWindowMode(stop.timeWindow.mode)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">{window}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {formatDeliveryPriority(stop.priority)}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {formatServicePolicy(stop.servicePolicy)}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </details>

      <ReviewDetails title="Vehicles" icon={Truck}>
        {costOptimizationActive ? (
          <div className="mb-4 grid gap-3 rounded-md border border-border bg-surface-low p-3 text-sm md:grid-cols-3">
            <SummaryPill
              label="Optimization"
              value="Lowest operating cost"
            />
            <SummaryPill
              label="Vehicle costs configured"
              value={`${vehiclesWithCostCount} / ${vehicles.length}`}
            />
            <SummaryPill
              label="Estimated cost model"
              value="Fixed + distance + working time"
            />
          </div>
        ) : null}
        <details className="mb-4 rounded-md border border-border bg-surface-low">
          <summary className="cursor-pointer list-none px-3 py-2 font-display text-xs font-semibold uppercase text-muted-foreground">
            Estimated cost model
          </summary>
          <div className="grid gap-3 border-t border-border p-3 md:grid-cols-6">
            <CostInput
              label={`Fixed (${currency})`}
              onChange={(value) => setBulkCost({ ...bulkCost, fixedCost: value })}
              step="0.01"
              value={bulkCost.fixedCost}
            />
            <CostInput
              label={`${currency} / km`}
              onChange={(value) => setBulkCost({ ...bulkCost, costPerKm: value })}
              step="0.01"
              value={bulkCost.costPerKm}
            />
            <CostInput
              label={`${currency} / hour`}
              onChange={(value) => setBulkCost({ ...bulkCost, costPerHour: value })}
              step="0.01"
              value={bulkCost.costPerHour}
            />
            <CostInput
              label="Overtime after"
              onChange={(value) =>
                setBulkCost({ ...bulkCost, overtimeAfterMinutes: value })
              }
              step="1"
              value={bulkCost.overtimeAfterMinutes}
            />
            <CostInput
              label={`${currency} / overtime h`}
              onChange={(value) =>
                setBulkCost({ ...bulkCost, overtimeCostPerHour: value })
              }
              step="0.01"
              value={bulkCost.overtimeCostPerHour}
            />
            <button
              className="self-end rounded-lg border border-border bg-card px-3 py-2 font-display text-xs font-semibold text-foreground transition-colors hover:bg-surface"
              onClick={applyBulkVehicleCosts}
              type="button"
            >
              Apply to all vehicles
            </button>
          </div>
        </details>
        <details className="mb-4 rounded-md border border-border bg-surface-low">
          <summary className="cursor-pointer list-none px-3 py-2 font-display text-xs font-semibold uppercase text-muted-foreground">
            Load constraints
          </summary>
          <div className="flex flex-wrap gap-2 border-t border-border p-3">
            {builtInCapacityDimensions.map((dimension) => (
              <button
                className="rounded-lg border border-border bg-card px-3 py-2 font-display text-xs font-semibold text-foreground transition-colors hover:bg-surface"
                disabled={capacityDimensions.some((item) => item.key === dimension.key)}
                key={dimension.key}
                onClick={() => addCapacityDimension(dimension)}
                type="button"
              >
                {dimension.label}
              </button>
            ))}
          </div>
        </details>
        <ul className="flex flex-col gap-2">
          {vehicles.map(
            (vehicle) => (
              <li
                className="grid gap-3 rounded-md border border-border p-3 lg:grid-cols-[1fr_2fr]"
                key={vehicle.id}
              >
                <div>
                  <p className="font-display text-sm font-semibold text-foreground">
                    {vehicle.name}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatVehicleCapacities(vehicle, capacityDimensions)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {vehicle.operatingCost
                      ? `Fixed ${formatMoneyMinor(
                          toMinor(vehicle.operatingCost.fixedCost),
                          currency,
                        )}`
                      : "Add operating costs"}
                  </p>
                </div>
                {capacityDimensions.length > 0 ? (
                  <div className="grid gap-2 sm:grid-cols-4">
                    {capacityDimensions.map((dimension) => (
                      <CostInput
                        key={dimension.key}
                        label={`${dimension.label} ${dimension.unit ? `(${dimension.unit})` : ""}`}
                        onChange={(value) =>
                          updateVehicleCapacity(vehicle.id, dimension.key, value)
                        }
                        step={dimension.valueType === "integer" ? "1" : "0.01"}
                        value={vehicleCapacityValue(vehicle, dimension.key)}
                      />
                    ))}
                  </div>
                ) : null}
                {costOptimizationActive || vehicle.operatingCost ? (
                <div className="grid gap-2 sm:grid-cols-5">
                  <CostInput
                    label="Fixed"
                    onChange={(value) => updateVehicleCost(vehicle.id, { fixedCost: value })}
                    step="0.01"
                    value={vehicle.operatingCost?.fixedCost}
                  />
                  <CostInput
                    label="Cost/km"
                    onChange={(value) => updateVehicleCost(vehicle.id, { costPerKm: value })}
                    step="0.01"
                    value={vehicle.operatingCost?.costPerKm}
                  />
                  <CostInput
                    label="Cost/hour"
                    onChange={(value) => updateVehicleCost(vehicle.id, { costPerHour: value })}
                    step="0.01"
                    value={vehicle.operatingCost?.costPerHour}
                  />
                  <CostInput
                    label="OT after"
                    onChange={(value) =>
                      updateVehicleCost(vehicle.id, { overtimeAfterMinutes: value })
                    }
                    step="1"
                    value={vehicle.operatingCost?.overtimeAfterMinutes}
                  />
                  <CostInput
                    label="OT/hour"
                    onChange={(value) =>
                      updateVehicleCost(vehicle.id, { overtimeCostPerHour: value })
                    }
                    step="0.01"
                    value={vehicle.operatingCost?.overtimeCostPerHour}
                  />
                </div>
                ) : null}
              </li>
            ),
          )}
        </ul>
      </ReviewDetails>

      <ReviewDetails title="Requirements" icon={Route}>
        <div className="flex flex-col gap-2">
          {[
            "Capacity",
            `${timeWindowCount} time windows`,
            returnToDepot ? "Return to depot" : "Open route",
            `${requirementCounts.required ?? 0} required operations`,
            pickupDeliveryJobCount > 0 ? "Pickup before delivery" : null,
          ].filter(Boolean).map((constraint) => (
            <div
              className="flex items-center gap-2 rounded-md border border-primary-accent/20 bg-primary-accent/10 px-3 py-2 font-display text-xs font-semibold text-primary-accent"
              key={constraint}
            >
              <CheckCircle2 aria-hidden className="h-4 w-4" />
              {constraint}
            </div>
          ))}
        </div>
      </ReviewDetails>
    </div>
  );
}

function ReviewDetails({
  children,
  icon: Icon,
  title,
}: {
  children: React.ReactNode;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
}) {
  return (
    <details className="group rounded-lg border border-border bg-surface">
      <summary className="flex cursor-pointer list-none items-center justify-between p-4">
        <span className="flex items-center gap-3 font-display text-sm font-semibold text-foreground">
          <Icon
            aria-hidden
            className="h-5 w-5 text-muted-foreground"
            strokeWidth={1.8}
          />
          {title}
        </span>
        <ChevronDown
          aria-hidden
          className="h-5 w-5 text-muted-foreground transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="border-t border-border bg-card p-4">{children}</div>
    </details>
  );
}

function SummaryPill({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-display text-xs font-semibold uppercase text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm text-foreground">{value}</p>
    </div>
  );
}

function ControlSelect({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: string[];
  value: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-display text-xs font-medium text-muted-foreground">
        {label}
      </span>
      <select
        className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary-accent"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {displayOption(option)}
          </option>
        ))}
      </select>
    </label>
  );
}

function displayOption(option: string) {
  const labels: Record<string, string> = {
    hard: "Strict",
    soft: "Flexible",
    required: "Required",
    preferred: "Preferred",
    optional: "Optional",
    critical: "Critical",
    high: "High",
    normal: "Normal",
    low: "Low",
  };

  return labels[option] ?? option.replace("_", " ");
}

function CostInput({
  label,
  onChange,
  step,
  value,
}: {
  label: string;
  onChange: (value: number | undefined) => void;
  step: string;
  value?: number;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-display text-xs font-medium text-muted-foreground">
        {label}
      </span>
      <input
        className="min-w-0 rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary-accent"
        min={0}
        onChange={(event) => onChange(numberFromInput(event.target.value))}
        step={step}
        type="number"
        value={typeof value === "number" ? value : ""}
      />
    </label>
  );
}

function countBy(values: string[]) {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;

    return counts;
  }, {});
}

function numberFromInput(value: string) {
  if (!value.trim()) {
    return undefined;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : undefined;
}

function hasOperatingCostModel(cost?: VehicleOperatingCost) {
  if (!cost) {
    return false;
  }

  return [
    cost.fixedCost,
    cost.costPerKm,
    cost.costPerHour,
    cost.overtimeCostPerHour,
  ].some((value) => typeof value === "number" && value > 0);
}

function formatVehicleCapacities(
  vehicle: Vehicle,
  dimensions: CapacityDimensionDefinition[],
) {
  const values = dimensions
    .map((dimension) =>
      formatCapacityValue(vehicleCapacityValue(vehicle, dimension.key), dimension),
    )
    .filter(Boolean);

  return values.length > 0 ? `${values.join(" | ")} capacity` : "Capacity not set";
}

function compactOperatingCost(cost: VehicleOperatingCost): VehicleOperatingCost {
  return Object.fromEntries(
    Object.entries(cost).filter(([, value]) => typeof value !== "undefined"),
  ) as VehicleOperatingCost;
}

function toMinor(value?: number) {
  return typeof value === "number" ? Math.round(value * 100) : undefined;
}
