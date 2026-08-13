import type { DeliveryStop } from "@/lib/types";

import type { CapacityDimensionDefinition, CapacityValues } from "@/lib/types";

export type DeliveryImportField =
  | "name"
  | "address"
  | "demand"
  | "timeWindowStart"
  | "timeWindowEnd"
  | "serviceTimeMinutes";

export type ImportColumnMapping = Partial<Record<DeliveryImportField, string>>;

export type ImportIssueCode =
  | "IMPORT_UNSUPPORTED_FILE"
  | "IMPORT_FILE_TOO_LARGE"
  | "IMPORT_TOO_MANY_ROWS"
  | "IMPORT_EMPTY_FILE"
  | "IMPORT_MISSING_HEADER"
  | "IMPORT_MISSING_ADDRESS_COLUMN"
  | "IMPORT_MISSING_ADDRESS"
  | "IMPORT_INVALID_NUMBER"
  | "IMPORT_NEGATIVE_DEMAND"
  | "IMPORT_INVALID_TIME"
  | "IMPORT_INCOMPLETE_TIME_WINDOW"
  | "IMPORT_INVALID_TIME_WINDOW_ORDER"
  | "IMPORT_INVALID_SERVICE_TIME"
  | "IMPORT_NEGATIVE_SERVICE_TIME"
  | "IMPORT_DUPLICATE_ROW"
  | "IMPORT_MALFORMED_XLSX"
  | "IMPORT_ENCODING_ERROR"
  | "IMPORT_EXCEEDS_OPTIMIZATION_LIMIT";

export type ImportIssueSeverity = "error" | "warning";

export type ImportRowStatus = "valid" | "warning" | "invalid" | "skipped";

export type ParsedDeliveryRow = {
  rowNumber: number;
  values: Record<string, string>;
};

export type SkippedImportRow = {
  rowNumber: number;
  reason: "empty";
};

export type ImportValidationIssue = {
  code: ImportIssueCode;
  severity: ImportIssueSeverity;
  rowNumber?: number;
  field: DeliveryImportField | "file" | "mapping";
  column?: string;
  message: string;
};

export type NormalizedDeliveryRow = {
  rowNumber: number;
  status: ImportRowStatus;
  issues: ImportValidationIssue[];
  name: string;
  address?: string;
  demand?: number;
  demandRaw?: string;
  demands?: CapacityValues;
  timeWindowStart?: string;
  timeWindowStartRaw?: string;
  timeWindowEnd?: string;
  timeWindowEndRaw?: string;
  serviceTimeMinutes?: number;
  serviceTimeRaw?: string;
  duplicateKey?: string;
  stableId: string;
  rawValues: Record<string, string>;
};

export type ImportPreview = {
  fileName: string;
  fileType: "csv" | "xlsx";
  sourceType: "csv" | "xlsx";
  sheetName?: string;
  availableSheets: string[];
  headers: string[];
  sourceRows: ParsedDeliveryRow[];
  skippedRows: SkippedImportRow[];
  mapping: ImportColumnMapping;
  detectedColumns: ImportColumnMapping;
  detectedCapacityDimensions: CapacityDimensionDefinition[];
  missingRequiredFields: Array<"address">;
  rows: NormalizedDeliveryRow[];
  validRows: NormalizedDeliveryRow[];
  invalidRows: NormalizedDeliveryRow[];
  issues: ImportValidationIssue[];
  rowCount: number;
  totalRows: number;
  validRowCount: number;
  invalidRowCount: number;
  warningRowCount: number;
  skippedRowCount: number;
  canImport: boolean;
};

export type ImportedDeliveryStopsResult = {
  stops: DeliveryStop[];
  timeWindowCount: number;
};
