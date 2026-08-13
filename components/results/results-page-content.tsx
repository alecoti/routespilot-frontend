"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, Download, Edit, FileText, Route, X } from "lucide-react";

import {
  ResultOverview,
  ResultSubtitle,
} from "@/components/results/result-overview";
import { InfeasibilityDiagnosticsPanel } from "@/components/results/infeasibility-diagnostics";
import { ComparisonPanel } from "@/components/results/comparison-panel";
import { OptimizationOutcome } from "@/components/results/optimization-outcome";
import { PartialServiceSummary } from "@/components/results/partial-service-summary";
import { ResultsMap } from "@/components/results/results-map";
import { VehicleAssignments } from "@/components/results/vehicle-assignments";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  downloadCsv,
  downloadDriverSheet,
  downloadPdfPlan,
  downloadXlsx,
  type ExportFormat,
} from "@/lib/api/exports";
import type { RoutingResult } from "@/lib/types";
import { useOptimizationStore } from "@/providers/optimization-provider";

const downloadOptions: { format: ExportFormat; label: string }[] = [
  { format: "pdf", label: "PDF route plan" },
  { format: "csv", label: "Download CSV" },
  { format: "xlsx", label: "Download Excel" },
  { format: "driver_sheet", label: "Driver sheets" },
];

export function ResultsPageContent() {
  const problem = useOptimizationStore((state) => state.problem);
  const result = useOptimizationStore((state) => state.result);
  const diagnostics = useOptimizationStore((state) => state.diagnostics);
  const debugTiming = useOptimizationStore((state) => state.optimizationDebugTiming);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloadFormat, setDownloadFormat] = useState<ExportFormat | null>(
    null,
  );
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [selectedPdfVehicleIds, setSelectedPdfVehicleIds] = useState<string[]>(
    [],
  );
  const [isDownloadMenuOpen, setIsDownloadMenuOpen] = useState(false);
  const downloadMenuRef = useRef<HTMLDivElement | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (!isDownloadMenuOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (
        downloadMenuRef.current &&
        !downloadMenuRef.current.contains(event.target as Node)
      ) {
        setIsDownloadMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsDownloadMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isDownloadMenuOpen]);

  if (!result) {
    return (
      <div className="mx-auto flex min-h-screen max-w-[1440px] items-center px-4 py-8 md:px-6 md:py-10">
        <section className="max-w-xl">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-surface">
            <Route aria-hidden className="h-5 w-5 text-muted-foreground" />
          </div>
          <h1 className="font-display text-3xl font-semibold text-foreground md:text-4xl">
            No optimization result is available.
          </h1>
          <p className="mt-3 text-base leading-7 text-muted-foreground">
            Create an optimization from the conversation flow, then return here
            to review the calculated routes.
          </p>
          <Link
            className="mt-6 inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 font-display text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            href="/optimize"
          >
            Create optimization
          </Link>
        </section>
      </div>
    );
  }

  async function handleDownload(format: ExportFormat) {
    if (downloadFormat || !result) {
      return;
    }

    if (format === "pdf") {
      setSelectedPdfVehicleIds(
        result.routes
          .filter((route) => route.stops.length > 0)
          .map((route) => route.vehicleId),
      );
      setDownloadError(null);
      setIsPdfModalOpen(true);
      return;
    }

    setDownloadError(null);
    setDownloadFormat(format);

    try {
      if (format === "csv") {
        await downloadCsv(problem, result);
      } else if (format === "driver_sheet") {
        await downloadDriverSheet(problem, result);
      } else {
        await downloadXlsx(problem, result);
      }
    } catch {
      setDownloadError("We couldn't generate this file. Please try again.");
    } finally {
      setDownloadFormat(null);
    }
  }

  async function handlePdfDownload() {
    if (downloadFormat || !result || selectedPdfVehicleIds.length === 0) {
      return;
    }

    setDownloadError(null);
    setDownloadFormat("pdf");

    try {
      await downloadPdfPlan({
        problem,
        result,
        vehicleIds:
          selectedPdfVehicleIds.length === result.routes.length
            ? undefined
            : selectedPdfVehicleIds,
      });
      setIsPdfModalOpen(false);
    } catch {
      setDownloadError("We couldn't generate this PDF. Please try again.");
    } finally {
      setDownloadFormat(null);
    }
  }

  if (!result.feasible) {
    return (
      <InfeasibilityDiagnosticsPanel
        debugTiming={debugTiming}
        diagnostics={diagnostics}
        problem={problem}
        result={result}
      />
    );
  }

  return (
    <div className="mx-auto flex max-w-[1440px] flex-col gap-8 px-4 py-8 md:px-6 md:py-10">
      <header className="flex flex-col justify-between gap-4 border-b border-border pb-4 md:flex-row md:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-3xl font-semibold text-foreground md:text-4xl">
              Route plan
            </h1>
            {result.feasible ? (
              <StatusBadge icon>Optimized</StatusBadge>
            ) : (
              <StatusBadge className="border-destructive/20 bg-destructive/10 text-destructive">
                Infeasible
              </StatusBadge>
            )}
          </div>
          <ResultSubtitle />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 font-display text-sm font-medium text-foreground transition-colors hover:bg-surface-low"
            href="/review"
          >
            <Edit aria-hidden className="h-4 w-4" />
            Edit & optimize again
          </Link>
          <div className="relative" ref={downloadMenuRef}>
            <button
              aria-expanded={isDownloadMenuOpen}
              aria-haspopup="menu"
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 font-display text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={Boolean(downloadFormat) || !result.feasible}
              onClick={() => setIsDownloadMenuOpen((isOpen) => !isOpen)}
              type="button"
            >
              <Download aria-hidden className="h-4 w-4" />
              {downloadFormat ? "Preparing file..." : "Download plan"}
              <ChevronDown
                aria-hidden
                className={
                  isDownloadMenuOpen
                    ? "h-4 w-4 rotate-180 transition-transform"
                    : "h-4 w-4 transition-transform"
                }
              />
            </button>
            <div
              className={
                isDownloadMenuOpen
                  ? "absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-lg border border-border bg-card py-1 shadow-[0_12px_32px_rgba(0,0,0,0.14)]"
                  : "hidden"
              }
              role="menu"
            >
              {downloadOptions.map((option, index) => (
                <button
                  className={
                    index === 3
                      ? "block w-full border-t border-border px-4 py-2.5 text-left text-sm text-foreground hover:bg-surface-low focus:bg-surface-low focus:outline-none disabled:cursor-not-allowed disabled:text-muted-foreground"
                      : "block w-full px-4 py-2.5 text-left text-sm text-foreground hover:bg-surface-low focus:bg-surface-low focus:outline-none disabled:cursor-not-allowed disabled:text-muted-foreground"
                  }
                  disabled={Boolean(downloadFormat) || !result.feasible}
                  key={option.format}
                  onClick={() => {
                    setIsDownloadMenuOpen(false);
                    void handleDownload(option.format);
                  }}
                  role="menuitem"
                  type="button"
                >
                  {downloadFormat === option.format
                    ? "Preparing..."
                    : option.label}
                </button>
              ))}
            </div>
            {downloadError ? (
              <p className="absolute right-0 mt-2 w-64 rounded-lg border border-destructive/20 bg-card px-3 py-2 text-sm text-destructive shadow-[0_4px_12px_rgba(0,0,0,0.08)]">
                {downloadError}
              </p>
            ) : null}
          </div>
        </div>
      </header>

      <ResultOverview />

      <PartialServiceSummary problem={problem} result={result} />

      <ComparisonPanel />

      <OptimizationOutcome problem={problem} result={result} />

      <section className="flex flex-col gap-6 lg:h-[600px] lg:flex-row">
        <ResultsMap
          onSelectedVehicleChange={setSelectedVehicleId}
          selectedVehicleId={selectedVehicleId}
        />
        <VehicleAssignments
          onSelectedVehicleChange={setSelectedVehicleId}
          selectedVehicleId={selectedVehicleId}
        />
      </section>

      {isPdfModalOpen ? (
        <PdfExportModal
          downloadFormat={downloadFormat}
          onClose={() => setIsPdfModalOpen(false)}
          onConfirm={() => void handlePdfDownload()}
          onSelectionChange={setSelectedPdfVehicleIds}
          result={result}
          selectedVehicleIds={selectedPdfVehicleIds}
        />
      ) : null}
    </div>
  );
}

function PdfExportModal({
  downloadFormat,
  onClose,
  onConfirm,
  onSelectionChange,
  result,
  selectedVehicleIds,
}: {
  downloadFormat: ExportFormat | null;
  onClose: () => void;
  onConfirm: () => void;
  onSelectionChange: (vehicleIds: string[]) => void;
  result: RoutingResult;
  selectedVehicleIds: string[];
}) {
  const problem = useOptimizationStore((state) => state.problem);
  const vehicleById = new Map(
    problem.vehicles.map((vehicle) => [vehicle.id, vehicle.name]),
  );
  const routeOptions = result.routes.filter((route) => route.stops.length > 0);
  const selectedSet = new Set(selectedVehicleIds);
  const allSelected = selectedVehicleIds.length === routeOptions.length;

  function toggleVehicle(vehicleId: string) {
    if (selectedSet.has(vehicleId)) {
      onSelectionChange(selectedVehicleIds.filter((id) => id !== vehicleId));
      return;
    }

    onSelectionChange([...selectedVehicleIds, vehicleId]);
  }

  function selectAll() {
    onSelectionChange(routeOptions.map((route) => route.vehicleId));
  }

  function clearSelection() {
    onSelectionChange([]);
  }

  return (
    <div
      aria-labelledby="pdf-export-title"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 py-6 backdrop-blur-sm"
      role="dialog"
    >
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
        <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div className="flex gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileText aria-hidden className="h-5 w-5" />
            </div>
            <div>
              <h2
                className="font-display text-xl font-semibold text-foreground"
                id="pdf-export-title"
              >
                Export PDF route plan
              </h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Choose which vehicle routes to include in the printable plan.
                The PDF includes a map preview, route links, and ordered stop
                lists.
              </p>
            </div>
          </div>
          <button
            aria-label="Close PDF export"
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-surface-low hover:text-foreground"
            disabled={downloadFormat === "pdf"}
            onClick={onClose}
            type="button"
          >
            <X aria-hidden className="h-5 w-5" />
          </button>
        </header>

        <div className="overflow-y-auto px-5 py-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3">
            <div>
              <p className="font-display text-sm font-semibold text-foreground">
                {selectedVehicleIds.length} of {routeOptions.length} routes
                selected
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Export all routes or only the tours you want to share.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-low"
                onClick={allSelected ? clearSelection : selectAll}
                type="button"
              >
                {allSelected ? "Clear" : "Select all"}
              </button>
            </div>
          </div>

          <div className="grid gap-3">
            {routeOptions.map((route) => {
              const vehicleName =
                vehicleById.get(route.vehicleId) ?? route.vehicleId;
              const checked = selectedSet.has(route.vehicleId);

              return (
                <label
                  className={
                    checked
                      ? "flex cursor-pointer items-center gap-3 rounded-lg border border-primary/40 bg-primary/5 px-4 py-3"
                      : "flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 hover:bg-surface-low"
                  }
                  key={route.vehicleId}
                >
                  <input
                    checked={checked}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                    onChange={() => toggleVehicle(route.vehicleId)}
                    type="checkbox"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-sm font-semibold text-foreground">
                      {vehicleName}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {route.stops.length} stops |{" "}
                      {formatRouteDistance(route.distanceMeters, route.distanceKm)} |{" "}
                      {formatRouteDuration(
                        route.durationSeconds,
                        route.durationMinutes,
                      )}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        <footer className="flex flex-col-reverse gap-3 border-t border-border px-5 py-4 sm:flex-row sm:justify-end">
          <button
            className="inline-flex items-center justify-center rounded-lg border border-border bg-card px-4 py-2 font-display text-sm font-medium text-foreground transition-colors hover:bg-surface-low disabled:cursor-not-allowed disabled:opacity-60"
            disabled={downloadFormat === "pdf"}
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 font-display text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={
              downloadFormat === "pdf" || selectedVehicleIds.length === 0
            }
            onClick={onConfirm}
            type="button"
          >
            <Download aria-hidden className="h-4 w-4" />
            {downloadFormat === "pdf" ? "Preparing PDF..." : "Export PDF"}
          </button>
        </footer>
      </div>
    </div>
  );
}

function formatRouteDistance(distanceMeters?: number, distanceKm?: number) {
  const kilometers =
    typeof distanceMeters === "number" ? distanceMeters / 1000 : distanceKm;

  if (typeof kilometers !== "number") {
    return "-";
  }

  return `${kilometers.toFixed(kilometers >= 10 ? 0 : 1)} km`;
}

function formatRouteDuration(durationSeconds?: number, durationMinutes?: number) {
  const minutes =
    typeof durationSeconds === "number"
      ? Math.round(durationSeconds / 60)
      : durationMinutes;

  if (typeof minutes !== "number") {
    return "-";
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = Math.round(minutes % 60);

  if (hours && remainingMinutes) {
    return `${hours}h ${remainingMinutes}m`;
  }

  return hours ? `${hours}h` : `${remainingMinutes}m`;
}
