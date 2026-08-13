"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, FileSpreadsheet, X } from "lucide-react";

import type {
  DeliveryImportField,
  ImportColumnMapping,
  ImportPreview,
} from "@/lib/import/delivery-import-types";
import { getImportFieldLabel } from "@/lib/import/delivery-import";
import { cn } from "@/lib/utils";

const importFields: DeliveryImportField[] = [
  "name",
  "address",
  "demand",
  "timeWindowStart",
  "timeWindowEnd",
  "serviceTimeMinutes",
];

const requiredImportFields = new Set<DeliveryImportField>(["address"]);

export function DeliveryImportPreview({
  existingStopCount,
  importMode,
  onClear,
  onImport,
  onImportModeChange,
  onMappingChange,
  onSheetChange,
  preview,
}: {
  existingStopCount: number;
  importMode: "replace" | "append";
  onClear: () => void;
  onImport: () => void;
  onImportModeChange: (mode: "replace" | "append") => void;
  onMappingChange: (mapping: ImportColumnMapping) => void;
  onSheetChange: (sheetName: string) => void;
  preview: ImportPreview;
}) {
  const [showPreview, setShowPreview] = useState(false);
  const [showIssues, setShowIssues] = useState(false);
  const [showMapping, setShowMapping] = useState(
    preview.missingRequiredFields.length > 0,
  );
  const mappedFields = importFields.filter((field) => preview.mapping[field]);

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="rounded-xl border border-surface-highest bg-card p-5 text-base leading-7 text-foreground shadow-[0_4px_12px_rgba(0,0,0,0.03)]">
        <div className="mb-4 flex items-center gap-3 border-b border-border pb-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-container text-primary">
            <FileSpreadsheet aria-hidden className="h-4 w-4" strokeWidth={1.8} />
          </div>
          <p className="font-display text-xs font-semibold uppercase text-muted-foreground">
            File import
          </p>
        </div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-display text-base font-medium text-foreground">
                  {preview.fileName}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {preview.totalRows} rows detected
                  {preview.sheetName ? ` | Sheet: ${preview.sheetName}` : ""}
                </p>
              </div>
              <button
                aria-label="Remove file"
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-surface-container hover:text-foreground"
                onClick={onClear}
                type="button"
              >
                <X aria-hidden className="h-4 w-4" />
              </button>
            </div>

            {preview.availableSheets.length > 1 ? (
              <SheetSelector
                onSheetChange={onSheetChange}
                preview={preview}
              />
            ) : null}

            <div className="mt-5 rounded-lg border border-border bg-surface-low p-4">
              <p className="font-display text-xs font-semibold uppercase text-muted-foreground">
                Detected columns
              </p>
              {mappedFields.length > 0 ? (
                <ul className="mt-3 grid gap-2 text-sm text-foreground sm:grid-cols-2">
                  {mappedFields.map((field) => (
                    <li
                      className="flex items-center justify-between gap-3"
                      key={field}
                    >
                      <span className="truncate text-muted-foreground">
                        {preview.mapping[field]}
                      </span>
                      <span className="shrink-0 font-display font-medium">
                        {getImportFieldLabel(field)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">
                  No known delivery columns were detected.
                </p>
              )}
            </div>

            <div className="mt-4 grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
              <StatusLine
                healthy={preview.validRows.length > 0}
                label={`${preview.validRowCount} valid rows`}
              />
              <StatusLine
                healthy={preview.invalidRowCount === 0}
                label={`${preview.invalidRowCount} invalid rows`}
              />
              <StatusLine
                healthy={preview.warningRowCount === 0}
                label={`${preview.warningRowCount} rows with warnings`}
              />
              <StatusLine
                healthy
                label={`${preview.skippedRowCount} empty rows skipped`}
              />
            </div>

            {preview.validRowCount > 49 ? (
              <p className="mt-3 rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm leading-6 text-amber-700">
                This file has more rows than the current V1 optimization limit.
                You can preview it, but reduce the delivery list before optimizing.
              </p>
            ) : null}

            {preview.invalidRowCount > 0 ? (
              <p className="mt-3 rounded-md border border-border bg-surface-low px-3 py-2 text-sm leading-6 text-muted-foreground">
                Invalid rows will be excluded when you choose{" "}
                <span className="font-display font-semibold text-foreground">
                  Import {preview.validRowCount} valid rows
                </span>
                .
              </p>
            ) : null}

            {showMapping ? (
              <MappingEditor
                headers={preview.headers}
                mapping={preview.mapping}
                onMappingChange={onMappingChange}
              />
            ) : null}

            {showPreview ? <RowsPreview preview={preview} /> : null}

            {showIssues ? <IssuesList preview={preview} /> : null}

            {existingStopCount > 0 ? (
              <ImportModeSelector
                existingStopCount={existingStopCount}
                importMode={importMode}
                onImportModeChange={onImportModeChange}
              />
            ) : null}

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                className="rounded-full border border-border bg-surface px-4 py-2 font-display text-sm font-medium text-foreground transition-colors hover:bg-surface-container"
                onClick={() => setShowPreview((current) => !current)}
                type="button"
              >
                Preview
              </button>
              <button
                className={cn(
                  "rounded-full border px-4 py-2 font-display text-sm font-medium transition-colors",
                  preview.missingRequiredFields.length > 0
                    ? "border-primary-accent bg-primary-accent text-primary-foreground"
                    : "border-border bg-surface text-foreground hover:bg-surface-container",
                )}
                onClick={() => setShowMapping((current) => !current)}
                type="button"
              >
                Review mapping
              </button>
              {preview.issues.length > 0 ? (
                <button
                  className="rounded-full border border-border bg-surface px-4 py-2 font-display text-sm font-medium text-foreground transition-colors hover:bg-surface-container"
                  onClick={() => setShowIssues((current) => !current)}
                  type="button"
                >
                  Review issues
                </button>
              ) : null}
              <button
                className="rounded-full bg-foreground px-5 py-2 font-display text-sm font-medium text-card transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={!preview.canImport}
                onClick={onImport}
                type="button"
              >
                {preview.invalidRowCount > 0
                  ? `Import ${preview.validRowCount} valid rows`
                  : `Import ${preview.validRowCount} rows`}
              </button>
            </div>
      </div>
    </div>
  );
}

function SheetSelector({
  onSheetChange,
  preview,
}: {
  onSheetChange: (sheetName: string) => void;
  preview: ImportPreview;
}) {
  return (
    <label className="mt-5 flex flex-col gap-1 rounded-lg border border-border bg-surface-low p-4">
      <span className="font-display text-xs font-semibold uppercase text-muted-foreground">
        Worksheet
      </span>
      <select
        className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary-accent focus:ring-2 focus:ring-primary-accent/10"
        onChange={(event) => onSheetChange(event.target.value)}
        value={preview.sheetName ?? preview.availableSheets[0] ?? ""}
      >
        {preview.availableSheets.map((sheetName) => (
          <option key={sheetName} value={sheetName}>
            {sheetName}
          </option>
        ))}
      </select>
    </label>
  );
}

function ImportModeSelector({
  existingStopCount,
  importMode,
  onImportModeChange,
}: {
  existingStopCount: number;
  importMode: "replace" | "append";
  onImportModeChange: (mode: "replace" | "append") => void;
}) {
  return (
    <div className="mt-5 rounded-lg border border-border bg-surface-low p-4">
      <p className="font-display text-xs font-semibold uppercase text-muted-foreground">
        Current deliveries
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        This optimization already has {existingStopCount} deliveries.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {[
          ["replace", "Replace current deliveries"],
          ["append", "Add to current deliveries"],
        ].map(([mode, label]) => (
          <button
            className={cn(
              "rounded-md border px-3 py-2 text-left font-display text-sm font-medium transition-colors",
              importMode === mode
                ? "border-primary-accent bg-primary-accent text-primary-foreground"
                : "border-border bg-card text-foreground hover:bg-surface-container",
            )}
            key={mode}
            onClick={() => onImportModeChange(mode as "replace" | "append")}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function MappingEditor({
  headers,
  mapping,
  onMappingChange,
}: {
  headers: string[];
  mapping: ImportColumnMapping;
  onMappingChange: (mapping: ImportColumnMapping) => void;
}) {
  function handleChange(field: DeliveryImportField, value: string) {
    const nextMapping = { ...mapping };

    if (value) {
      nextMapping[field] = value;
    } else {
      delete nextMapping[field];
    }

    onMappingChange(nextMapping);
  }

  return (
    <div className="mt-5 rounded-lg border border-border bg-surface-low p-4">
      <p className="font-display text-xs font-semibold uppercase text-muted-foreground">
        Column mapping
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {importFields.map((field) => (
          <label className="flex flex-col gap-1" key={field}>
            <span className="font-display text-xs font-medium text-muted-foreground">
              {getImportFieldLabel(field)}
              {requiredImportFields.has(field) ? " *" : ""}
            </span>
            <select
              className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary-accent focus:ring-2 focus:ring-primary-accent/10"
              onChange={(event) => handleChange(field, event.target.value)}
              value={mapping[field] ?? ""}
            >
              <option value="">Not mapped</option>
              {headers.map((header) => (
                <option key={header} value={header}>
                  {header}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
    </div>
  );
}

function RowsPreview({ preview }: { preview: ImportPreview }) {
  return (
    <div className="mt-5 overflow-hidden rounded-lg border border-border">
      <div className="grid grid-cols-[64px_92px_1fr_1fr] bg-surface-low px-3 py-2 font-display text-xs font-semibold uppercase text-muted-foreground">
        <span>Row</span>
        <span>Status</span>
        <span>Name</span>
        <span>Address</span>
      </div>
      {preview.rows.slice(0, 5).map((row) => {
        const hasError = row.status === "invalid";

        return (
          <div
            className={cn(
              "grid grid-cols-[64px_92px_1fr_1fr] gap-3 border-t border-border px-3 py-2 text-sm",
              hasError ? "text-muted-foreground" : "text-foreground",
            )}
            key={row.rowNumber}
          >
            <span>{row.rowNumber}</span>
            <span className="capitalize">{row.status}</span>
            <span className="truncate">{row.name ?? "-"}</span>
            <span className="truncate">{row.address ?? "-"}</span>
          </div>
        );
      })}
      {preview.rows.length > 5 ? (
        <p className="border-t border-border px-3 py-2 text-sm text-muted-foreground">
          Showing 5 of {preview.rows.length} rows.
        </p>
      ) : null}
    </div>
  );
}

function IssuesList({ preview }: { preview: ImportPreview }) {
  return (
    <div className="mt-5 rounded-lg border border-border bg-surface-low p-4">
      <p className="font-display text-xs font-semibold uppercase text-muted-foreground">
        Issues
      </p>
      <ul className="mt-3 flex flex-col gap-2 text-sm text-muted-foreground">
        {preview.issues.slice(0, 8).map((issue, index) => (
          <li
            className="flex gap-2"
            key={`${issue.field}-${issue.rowNumber}-${index}`}
          >
            <AlertCircle
              aria-hidden
              className={cn(
                "mt-0.5 h-4 w-4 shrink-0",
                issue.severity === "error"
                  ? "text-destructive"
                  : "text-amber-500",
              )}
            />
            <span>
              {issue.rowNumber ? `Row ${issue.rowNumber}: ` : ""}
              {issue.column ? `${issue.column}: ` : ""}
              {issue.message}
              <span className="ml-2 font-mono text-xs text-muted-foreground">
                {issue.code}
              </span>
            </span>
          </li>
        ))}
      </ul>
      {preview.issues.length > 8 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Showing 8 of {preview.issues.length} issues.
        </p>
      ) : null}
    </div>
  );
}

function StatusLine({ healthy, label }: { healthy: boolean; label: string }) {
  return (
    <p className="flex items-center gap-2">
      {healthy ? (
        <CheckCircle2 aria-hidden className="h-4 w-4 text-primary-accent" />
      ) : (
        <AlertCircle aria-hidden className="h-4 w-4 text-amber-500" />
      )}
      {label}
    </p>
  );
}
