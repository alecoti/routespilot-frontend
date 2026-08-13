"use client";

import { MetricValue } from "@/components/ui/metric-value";
import { formatLocationAddress } from "@/lib/locations";
import { useOptimizationStore } from "@/providers/optimization-provider";

export function ProblemMetrics() {
  const depot = useOptimizationStore((state) => state.problem.depot);
  const stops = useOptimizationStore((state) => state.problem.stops);
  const vehicles = useOptimizationStore((state) => state.problem.vehicles);
  const timeWindowCount = useOptimizationStore(
    (state) => state.problem.stops.filter((stop) => stop.timeWindow).length,
  );

  return (
    <div className="mb-10 grid grid-cols-2 gap-6 sm:grid-cols-4">
      <MetricValue label="Deliveries" value={String(stops.length)} />
      <MetricValue label="Vehicles" value={String(vehicles.length)} />
      <MetricValue label="Time Windows" value={String(timeWindowCount)} />
      <MetricValue label="Depot" value={formatLocationAddress(depot)} />
    </div>
  );
}
