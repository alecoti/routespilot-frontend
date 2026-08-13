"use client";

import dynamic from "next/dynamic";
import { AlertCircle, Map } from "lucide-react";

import { useOptimizationStore } from "@/providers/optimization-provider";

const DynamicRouteMap = dynamic(
  () =>
    import("@/components/results/route-map/route-map").then(
      (module) => module.RouteMap,
    ),
  {
    loading: () => <MapSkeleton />,
    ssr: false,
  },
);

export function ResultsMap({
  onSelectedVehicleChange,
  selectedVehicleId,
}: {
  onSelectedVehicleChange: (vehicleId: string | null) => void;
  selectedVehicleId: string | null;
}) {
  const problem = useOptimizationStore((state) => state.problem);
  const result = useOptimizationStore((state) => state.result);
  const routeGeometries = useOptimizationStore((state) => state.routeGeometries);
  const routeGeometryError = useOptimizationStore(
    (state) => state.routeGeometryError,
  );

  if (!result || !result.feasible) {
    return (
      <MapUnavailable message="Map unavailable for infeasible route plans." />
    );
  }

  if (routeGeometryError || routeGeometries.length === 0) {
    return <MapUnavailable message="Map unavailable" />;
  }

  return (
    <div className="relative min-h-[420px] overflow-hidden rounded-xl border border-border bg-surface lg:min-h-0 lg:w-[65%]">
      <DynamicRouteMap
        onSelectedVehicleChange={onSelectedVehicleChange}
        problem={problem}
        result={result}
        routeGeometries={routeGeometries}
        selectedVehicleId={selectedVehicleId}
      />
    </div>
  );
}

function MapSkeleton() {
  return (
    <div className="flex h-full min-h-[420px] w-full items-center justify-center bg-surface-low">
      <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground shadow-[0_4px_12px_rgba(0,0,0,0.03)]">
        <Map aria-hidden className="h-4 w-4" />
        Loading map
      </div>
    </div>
  );
}

function MapUnavailable({ message }: { message: string }) {
  return (
    <div className="relative flex min-h-[420px] items-center justify-center overflow-hidden rounded-xl border border-border bg-surface lg:min-h-0 lg:w-[65%]">
      <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground shadow-[0_4px_12px_rgba(0,0,0,0.03)]">
        <AlertCircle aria-hidden className="h-4 w-4 text-amber-500" />
        {message}
      </div>
    </div>
  );
}
