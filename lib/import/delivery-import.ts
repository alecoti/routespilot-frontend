import {
  builtInCapacityDimensions,
  defaultCapacityDimension,
} from "@/lib/capacity";
import type {
  DeliveryImportField,
  ImportColumnMapping,
  ImportIssueCode,
  ImportPreview,
  ImportValidationIssue,
  ImportedDeliveryStopsResult,
  NormalizedDeliveryRow,
  ParsedDeliveryRow,
  SkippedImportRow,
} from "@/lib/import/delivery-import-types";
import type { CapacityDimensionDefinition } from "@/lib/types";

export const MAX_IMPORT_FILE_SIZE_MB = 5;
export const MAX_IMPORT_ROWS = 200;
export const MAX_OPTIMIZATION_STOPS = 49;

const maxFileSizeBytes = MAX_IMPORT_FILE_SIZE_MB * 1024 * 1024;
const requiredFields = ["address"] as const;

const fieldLabels: Record<DeliveryImportField, string> = {
  name: "Customer",
  address: "Address",
  demand: "Demand",
  timeWindowStart: "Window start",
  timeWindowEnd: "Window end",
  serviceTimeMinutes: "Service time",
};

const columnAliases: Record<DeliveryImportField, string[]> = {
  name: [
    "customer",
    "customer_name",
    "customer name",
    "client",
    "cliente",
    "name",
    "nome",
    "ragione sociale",
  ],
  address: [
    "address",
    "indirizzo",
    "street_address",
    "street address",
    "delivery_address",
    "delivery address",
    "street",
    "destination",
  ],
  demand: ["demand", "weight", "peso", "load", "quantity", "qty", "kg"],
  timeWindowStart: [
    "from",
    "start",
    "window_start",
    "window start",
    "time_window_start",
    "time window start",
    "delivery_from",
    "delivery from",
    "time_start",
    "time start",
    "dalle",
  ],
  timeWindowEnd: [
    "to",
    "end",
    "window_end",
    "window end",
    "time_window_end",
    "time window end",
    "delivery_to",
    "delivery to",
    "time_end",
    "time end",
    "alle",
  ],
  serviceTimeMinutes: [
    "service_time",
    "service time",
    "service_minutes",
    "service minutes",
    "service_duration",
    "service duration",
    "unloading_time",
    "unloading time",
  ],
};

const capacityColumnAliases: Record<
  string,
  { definition: CapacityDimensionDefinition; aliases: string[] }
> = {
  load: {
    definition: defaultCapacityDimension,
    aliases: ["demand", "weight", "peso", "load", "kg", "kilograms"],
  },
  volume: {
    definition: builtInCapacityDimensions.find((item) => item.key === "volume")!,
    aliases: ["volume", "volume m3", "m3", "m 3", "cubic meters"],
  },
  pallets: {
    definition: builtInCapacityDimensions.find((item) => item.key === "pallets")!,
    aliases: ["pallet", "pallets", "pallet count", "bancali"],
  },
  packages: {
    definition: builtInCapacityDimensions.find((item) => item.key === "packages")!,
    aliases: ["packages", "package", "boxes", "box", "colli", "parcels", "parcel"],
  },
};

type DetectedCapacityColumn = {
  header: string;
  definition: CapacityDimensionDefinition;
};

type ParseDeliveryFileOptions = {
  sheetName?: string;
};

type ParsedDeliveryTable = {
  availableSheets?: string[];
  headers: string[];
  rows: ParsedDeliveryRow[];
  sheetName?: string;
  skippedRows: SkippedImportRow[];
};

export class DeliveryImportError extends Error {
  code: ImportIssueCode;

  constructor(code: ImportIssueCode, message: string) {
    super(message);
    this.name = "DeliveryImportError";
    this.code = code;
  }
}

export async function parseDeliveryFile(
  file: File,
  options: ParseDeliveryFileOptions = {},
): Promise<ImportPreview> {
  if (file.size > maxFileSizeBytes) {
    throw new DeliveryImportError(
      "IMPORT_FILE_TOO_LARGE",
      `Files must be ${MAX_IMPORT_FILE_SIZE_MB} MB or smaller.`,
    );
  }

  const fileType = getSupportedFileType(file.name);

  if (!fileType) {
    throw new DeliveryImportError(
      "IMPORT_UNSUPPORTED_FILE",
      "Upload a .csv or .xlsx file.",
    );
  }

  const parsed =
    fileType === "csv"
      ? await parseCsvFile(file)
      : await parseXlsxFile(file, options.sheetName);

  return createImportPreview({
    availableSheets: parsed.availableSheets,
    fileName: file.name,
    fileType,
    headers: parsed.headers,
    parsedRows: parsed.rows,
    sheetName: parsed.sheetName,
    skippedRows: parsed.skippedRows,
  });
}

export function createImportPreview({
  availableSheets = [],
  fileName,
  fileType,
  headers,
  mapping = detectColumns(headers),
  parsedRows,
  sheetName,
  skippedRows = [],
}: {
  availableSheets?: string[];
  fileName: string;
  fileType: ImportPreview["fileType"];
  headers: string[];
  mapping?: ImportColumnMapping;
  parsedRows: ParsedDeliveryRow[];
  sheetName?: string;
  skippedRows?: SkippedImportRow[];
}): ImportPreview {
  if (headers.length === 0) {
    throw new DeliveryImportError(
      "IMPORT_MISSING_HEADER",
      "The file does not contain a usable header row.",
    );
  }

  if (parsedRows.length === 0) {
    throw new DeliveryImportError(
      "IMPORT_EMPTY_FILE",
      "The file does not contain delivery rows.",
    );
  }

  if (parsedRows.length > MAX_IMPORT_ROWS) {
    throw new DeliveryImportError(
      "IMPORT_TOO_MANY_ROWS",
      `Preview up to ${MAX_IMPORT_ROWS} delivery rows at a time.`,
    );
  }

  const capacityColumns = detectCapacityColumns(headers);
  const normalizedRows = applyDuplicateWarnings(
    normalizeRows(parsedRows, mapping, capacityColumns),
  );
  const mappingIssues = validateMapping(mapping);
  const rowIssues = normalizedRows.flatMap((row) => row.issues);
  const optimizationLimitIssues = optimizationLimitWarnings(normalizedRows);
  const issues = [...mappingIssues, ...rowIssues, ...optimizationLimitIssues];
  const missingRequiredFields = requiredFields.filter((field) => !mapping[field]);
  const validRows = normalizedRows.filter((row) => row.status !== "invalid");
  const invalidRows = normalizedRows.filter((row) => row.status === "invalid");
  const warningRowCount = normalizedRows.filter((row) => row.status === "warning").length;

  return {
    fileName,
    fileType,
    sourceType: fileType,
    sheetName,
    availableSheets,
    headers,
    sourceRows: parsedRows,
    skippedRows,
    mapping,
    detectedColumns: detectColumns(headers),
    detectedCapacityDimensions: uniqueCapacityDimensions(capacityColumns),
    missingRequiredFields,
    rows: normalizedRows,
    validRows,
    invalidRows,
    issues,
    rowCount: normalizedRows.length,
    totalRows: normalizedRows.length + skippedRows.length,
    validRowCount: validRows.length,
    invalidRowCount: invalidRows.length,
    warningRowCount,
    skippedRowCount: skippedRows.length,
    canImport: missingRequiredFields.length === 0 && validRows.length > 0,
  };
}

export function detectColumns(headers: string[]): ImportColumnMapping {
  const normalizedHeaders = headers.map((header) => ({
    source: header,
    normalized: normalizeHeader(header),
  }));
  const usedSources = new Set<string>();

  return (Object.keys(columnAliases) as DeliveryImportField[]).reduce(
    (mapping, field) => {
      const aliases = new Set(columnAliases[field].map(normalizeHeader));
      const match = normalizedHeaders.find(
        (header) =>
          aliases.has(header.normalized) && !usedSources.has(header.source),
      );

      if (!match) {
        return mapping;
      }

      usedSources.add(match.source);

      return {
        ...mapping,
        [field]: match.source,
      };
    },
    {} as ImportColumnMapping,
  );
}

export function normalizeRows(
  rows: ParsedDeliveryRow[],
  mapping: ImportColumnMapping,
  capacityColumns: DetectedCapacityColumn[] = [],
): NormalizedDeliveryRow[] {
  return rows.map((row) => {
    const nameRaw = readMappedValue(row, mapping.name);
    const addressRaw = readMappedValue(row, mapping.address);
    const demandRaw = readMappedValue(row, mapping.demand);
    const timeWindowStartRaw = readMappedValue(row, mapping.timeWindowStart);
    const timeWindowEndRaw = readMappedValue(row, mapping.timeWindowEnd);
    const serviceTimeRaw = readMappedValue(row, mapping.serviceTimeMinutes);
    const issues: ImportValidationIssue[] = [];
    const name = nameRaw || `Delivery row ${row.rowNumber}`;
    const demands = parseCapacityDemands(row, capacityColumns, issues);
    const demand = demands.load ?? parseDemand(demandRaw, row, mapping, issues);
    const timeWindowStart = parseTimeField(
      timeWindowStartRaw,
      row,
      "timeWindowStart",
      mapping.timeWindowStart,
      issues,
    );
    const timeWindowEnd = parseTimeField(
      timeWindowEndRaw,
      row,
      "timeWindowEnd",
      mapping.timeWindowEnd,
      issues,
    );
    const serviceTimeMinutes = parseServiceTime(
      serviceTimeRaw,
      row,
      mapping,
      issues,
    );

    if (!addressRaw) {
      issues.push(
        rowIssue({
          code: "IMPORT_MISSING_ADDRESS",
          column: mapping.address,
          field: "address",
          message: "Missing delivery address.",
          row,
        }),
      );
    }

    validateTimeWindowPair({
      end: timeWindowEnd,
      endRaw: timeWindowEndRaw,
      issues,
      mapping,
      row,
      start: timeWindowStart,
      startRaw: timeWindowStartRaw,
    });

    const duplicateKey =
      name && addressRaw
        ? `${normalizeDuplicateText(name)}|${normalizeDuplicateText(addressRaw)}`
        : undefined;
    const rowWithoutStatus: Omit<NormalizedDeliveryRow, "status"> = {
      rowNumber: row.rowNumber,
      issues,
      name,
      address: addressRaw,
      demand,
      demandRaw,
      demands: Object.keys(demands).length > 0 ? demands : undefined,
      timeWindowStart,
      timeWindowStartRaw,
      timeWindowEnd,
      timeWindowEndRaw,
      serviceTimeMinutes,
      serviceTimeRaw,
      duplicateKey,
      stableId: createStableStopId(row.rowNumber, name, addressRaw),
      rawValues: row.values,
    };

    return {
      ...rowWithoutStatus,
      status: statusForIssues(issues),
    };
  });
}

export function validateImportedRows(
  rows: NormalizedDeliveryRow[],
): ImportValidationIssue[] {
  return applyDuplicateWarnings(rows).flatMap((row) => row.issues);
}

export function createDeliveryStops(
  rows: NormalizedDeliveryRow[],
  existingStopIds: string[] = [],
): ImportedDeliveryStopsResult {
  const usedIds = new Set(existingStopIds);
  const stops = rows
    .filter((row) => row.status !== "invalid" && row.address)
    .map((row) => {
      const id = makeUniqueStopId(row.stableId, usedIds);

      return {
        id,
        name: row.name,
        address: row.address ?? "",
        demand: row.demand,
        demands: row.demands,
        serviceTimeSeconds:
          typeof row.serviceTimeMinutes === "number"
            ? row.serviceTimeMinutes * 60
            : undefined,
        timeWindow:
          row.timeWindowStart && row.timeWindowEnd
            ? {
                start: row.timeWindowStart,
                end: row.timeWindowEnd,
                mode: "hard" as const,
              }
            : undefined,
        priority: "normal" as const,
        servicePolicy: "required" as const,
      };
    });

  return {
    stops,
    timeWindowCount: stops.filter((stop) => stop.timeWindow).length,
  };
}

export function getImportFieldLabel(field: DeliveryImportField) {
  return fieldLabels[field];
}

export function detectCapacityColumns(headers: string[]): DetectedCapacityColumn[] {
  const normalizedHeaders = headers.map((header) => ({
    source: header,
    normalized: normalizeHeader(header),
  }));

  return Object.values(capacityColumnAliases).flatMap(({ aliases, definition }) => {
    const normalizedAliases = new Set(aliases.map(normalizeHeader));
    const match = normalizedHeaders.find((header) =>
      normalizedAliases.has(header.normalized),
    );

    return match ? [{ header: match.source, definition }] : [];
  });
}

export function parseDecimalNumber(value?: string): number | undefined {
  if (!value) {
    return undefined;
  }

  const normalizedValue = value.replace(/\s+/g, "").trim();

  if (!normalizedValue) {
    return undefined;
  }

  if (/^-?\d+$/.test(normalizedValue)) {
    return Number(normalizedValue);
  }

  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(normalizedValue)) {
    return Number(normalizedValue.replace(/,/g, ""));
  }

  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(normalizedValue)) {
    return Number(normalizedValue.replace(/\./g, "").replace(",", "."));
  }

  if (/^-?\d+[.,]\d+$/.test(normalizedValue)) {
    return Number(normalizedValue.replace(",", "."));
  }

  return undefined;
}

export function normalizeOptionalTime(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }

  const normalizedValue = normalizeImportedText(value);
  const match = /^(\d{1,2})[:.](\d{2})$/.exec(normalizedValue);

  if (!match) {
    return undefined;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours > 23 || minutes > 59) {
    return undefined;
  }

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function parseCsvText(text: string, delimiter = detectCsvDelimiter(text)) {
  return parseCsv(stripUtf8Bom(text), delimiter);
}

async function parseCsvFile(file: File): Promise<ParsedDeliveryTable> {
  const text = await readUtf8Text(file);
  const table = parseCsvText(text, detectCsvDelimiter(text));

  return rowsFromTable(table);
}

async function parseXlsxFile(
  file: File,
  selectedSheetName?: string,
): Promise<ParsedDeliveryTable> {
  try {
    const workbookData = await file.arrayBuffer();

    if (!hasXlsxZipSignature(workbookData)) {
      throw new DeliveryImportError(
        "IMPORT_MALFORMED_XLSX",
        "The workbook could not be read.",
      );
    }

    const xlsx = await import("xlsx");
    const workbook = xlsx.read(workbookData, {
      cellFormula: false,
      cellNF: false,
      cellText: true,
      type: "array",
    });

    if (workbook.SheetNames.length === 0) {
      throw new DeliveryImportError(
        "IMPORT_MALFORMED_XLSX",
        "The workbook could not be read.",
      );
    }

    const meaningfulSheets = workbook.SheetNames.map((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      const table = sheet
        ? xlsx.utils.sheet_to_json<unknown[]>(sheet, {
            blankrows: true,
            defval: "",
            header: 1,
            raw: false,
          })
        : [];

      return {
        sheetName,
        table,
        hasContent: table.some((row) =>
          row.some((cell) => normalizeCell(cell).length > 0),
        ),
      };
    }).filter((sheet) => sheet.hasContent);

    if (meaningfulSheets.length === 0) {
      throw new DeliveryImportError(
        "IMPORT_EMPTY_FILE",
        "The workbook does not contain usable sheets.",
      );
    }

    const selectedSheet =
      meaningfulSheets.find((sheet) => sheet.sheetName === selectedSheetName) ??
      meaningfulSheets[0];

    return rowsFromTable(selectedSheet.table, {
      availableSheets: meaningfulSheets.map((sheet) => sheet.sheetName),
      sheetName: selectedSheet.sheetName,
    });
  } catch (error) {
    if (error instanceof DeliveryImportError) {
      throw error;
    }

    throw new DeliveryImportError(
      "IMPORT_MALFORMED_XLSX",
      "The workbook could not be read.",
    );
  }
}

function rowsFromTable(
  table: unknown[][],
  options: { availableSheets?: string[]; sheetName?: string } = {},
): ParsedDeliveryTable {
  const headerIndex = table.findIndex((row) =>
    row.some((cell) => normalizeCell(cell).length > 0),
  );

  if (headerIndex === -1) {
    throw new DeliveryImportError("IMPORT_EMPTY_FILE", "The file is empty.");
  }

  const headerRow = table[headerIndex];
  const headerEntries = headerRow
    .map((header, columnIndex) => ({
      columnIndex,
      header: normalizeCell(header),
    }))
    .filter((entry) => entry.header.length > 0);
  const headers = headerEntries.map((entry) => entry.header);

  if (headers.length === 0) {
    throw new DeliveryImportError(
      "IMPORT_MISSING_HEADER",
      "The file does not contain usable columns.",
    );
  }

  const rows: ParsedDeliveryRow[] = [];
  const skippedRows: SkippedImportRow[] = [];

  table.slice(headerIndex + 1).forEach((rawRow, index) => {
    const rowNumber = headerIndex + index + 2;
    const values = headerEntries.reduce<Record<string, string>>(
      (currentValues, entry) => {
        currentValues[entry.header] = normalizeCell(rawRow[entry.columnIndex]);

        return currentValues;
      },
      {},
    );
    const isEmpty = Object.values(values).every((value) => value.length === 0);

    if (isEmpty) {
      skippedRows.push({ rowNumber, reason: "empty" });
      return;
    }

    rows.push({ rowNumber, values });
  });

  if (rows.length > MAX_IMPORT_ROWS) {
    throw new DeliveryImportError(
      "IMPORT_TOO_MANY_ROWS",
      `Preview up to ${MAX_IMPORT_ROWS} delivery rows at a time.`,
    );
  }

  return {
    ...options,
    headers,
    rows,
    skippedRows,
  };
}

function parseCsv(text: string, delimiter: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const nextCharacter = text[index + 1];

    if (character === '"' && inQuotes && nextCharacter === '"') {
      cell += '"';
      index += 1;
      continue;
    }

    if (character === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (character === delimiter && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((character === "\n" || character === "\r") && !inQuotes) {
      if (character === "\r" && nextCharacter === "\n") {
        index += 1;
      }

      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += character;
  }

  if (row.length > 0 || cell.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

function detectCsvDelimiter(text: string) {
  const candidates = [",", ";"];
  const sampleLines = stripUtf8Bom(text)
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .slice(0, 5);

  if (sampleLines.length === 0) {
    return ",";
  }

  return candidates
    .map((delimiter) => ({
      delimiter,
      score: sampleLines.reduce(
        (sum, line) => sum + countDelimiterOutsideQuotes(line, delimiter),
        0,
      ),
    }))
    .sort((left, right) => right.score - left.score)[0]?.delimiter ?? ",";
}

function countDelimiterOutsideQuotes(line: string, delimiter: string) {
  let count = 0;
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (character === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (character === delimiter && !inQuotes) {
      count += 1;
    }
  }

  return count;
}

function validateMapping(mapping: ImportColumnMapping): ImportValidationIssue[] {
  return requiredFields
    .filter((field) => !mapping[field])
    .map((field) => ({
      code: "IMPORT_MISSING_ADDRESS_COLUMN",
      field: "mapping" as const,
      message: `${fieldLabels[field]} column is required before import.`,
      severity: "error" as const,
    }));
}

function readMappedValue(row: ParsedDeliveryRow, column?: string) {
  if (!column) {
    return undefined;
  }

  const value = normalizeImportedText(row.values[column]);

  return value ? value : undefined;
}

function parseDemand(
  value: string | undefined,
  row: ParsedDeliveryRow,
  mapping: ImportColumnMapping,
  issues: ImportValidationIssue[],
) {
  if (!value) {
    return undefined;
  }

  const parsed = parseDecimalNumber(value);

  if (typeof parsed !== "number") {
    issues.push(
      rowIssue({
        code: "IMPORT_INVALID_NUMBER",
        column: mapping.demand,
        field: "demand",
        message: "Demand must be a valid number.",
        row,
      }),
    );

    return undefined;
  }

  if (parsed < 0) {
    issues.push(
      rowIssue({
        code: "IMPORT_NEGATIVE_DEMAND",
        column: mapping.demand,
        field: "demand",
        message: "Demand must be greater than or equal to 0.",
        row,
      }),
    );

    return undefined;
  }

  return parsed;
}

function parseCapacityDemands(
  row: ParsedDeliveryRow,
  capacityColumns: DetectedCapacityColumn[],
  issues: ImportValidationIssue[],
) {
  const demands: Record<string, number> = {};

  capacityColumns.forEach(({ definition, header }) => {
    const rawValue = readMappedValue(row, header);

    if (!rawValue) {
      return;
    }

    const parsed = parseDecimalNumber(rawValue);

    if (typeof parsed !== "number") {
      issues.push(
        rowIssue({
          code: "IMPORT_INVALID_NUMBER",
          column: header,
          field: "demand",
          message: `${definition.label} demand must be a valid number.`,
          row,
        }),
      );

      return;
    }

    if (parsed < 0) {
      issues.push(
        rowIssue({
          code: "IMPORT_NEGATIVE_DEMAND",
          column: header,
          field: "demand",
          message: `${definition.label} demand must be greater than or equal to 0.`,
          row,
        }),
      );

      return;
    }

    demands[definition.key] = parsed;
  });

  return demands;
}

function uniqueCapacityDimensions(
  capacityColumns: DetectedCapacityColumn[],
): CapacityDimensionDefinition[] {
  const byKey = new Map<string, CapacityDimensionDefinition>();

  capacityColumns.forEach(({ definition }) => {
    byKey.set(definition.key, definition);
  });

  return [...byKey.values()];
}

function parseServiceTime(
  value: string | undefined,
  row: ParsedDeliveryRow,
  mapping: ImportColumnMapping,
  issues: ImportValidationIssue[],
) {
  if (!value) {
    return undefined;
  }

  const normalizedValue = value.replace(/\s+/g, "");

  if (!/^-?\d+$/.test(normalizedValue)) {
    issues.push(
      rowIssue({
        code: "IMPORT_INVALID_SERVICE_TIME",
        column: mapping.serviceTimeMinutes,
        field: "serviceTimeMinutes",
        message: "Service time must be a whole number of minutes.",
        row,
      }),
    );

    return undefined;
  }

  const parsed = Number(normalizedValue);

  if (parsed < 0) {
    issues.push(
      rowIssue({
        code: "IMPORT_NEGATIVE_SERVICE_TIME",
        column: mapping.serviceTimeMinutes,
        field: "serviceTimeMinutes",
        message: "Service time must be greater than or equal to 0.",
        row,
      }),
    );

    return undefined;
  }

  return parsed;
}

function parseTimeField(
  value: string | undefined,
  row: ParsedDeliveryRow,
  field: "timeWindowStart" | "timeWindowEnd",
  column: string | undefined,
  issues: ImportValidationIssue[],
) {
  if (!value) {
    return undefined;
  }

  const normalizedTime = normalizeOptionalTime(value);

  if (!normalizedTime) {
    issues.push(
      rowIssue({
        code: "IMPORT_INVALID_TIME",
        column,
        field,
        message: "Time values must use a format like 08:30 or 8.30.",
        row,
      }),
    );
  }

  return normalizedTime;
}

function validateTimeWindowPair({
  end,
  endRaw,
  issues,
  mapping,
  row,
  start,
  startRaw,
}: {
  end?: string;
  endRaw?: string;
  issues: ImportValidationIssue[];
  mapping: ImportColumnMapping;
  row: ParsedDeliveryRow;
  start?: string;
  startRaw?: string;
}) {
  if (Boolean(startRaw) !== Boolean(endRaw)) {
    issues.push(
      rowIssue({
        code: "IMPORT_INCOMPLETE_TIME_WINDOW",
        column: startRaw ? mapping.timeWindowEnd : mapping.timeWindowStart,
        field: startRaw ? "timeWindowEnd" : "timeWindowStart",
        message: "Time windows need both start and end values.",
        row,
      }),
    );
    return;
  }

  if (start && end && timeToMinutes(end) <= timeToMinutes(start)) {
    issues.push(
      rowIssue({
        code: "IMPORT_INVALID_TIME_WINDOW_ORDER",
        column: mapping.timeWindowEnd,
        field: "timeWindowEnd",
        message: "Window end must be later than the start.",
        row,
      }),
    );
  }
}

function applyDuplicateWarnings(
  rows: NormalizedDeliveryRow[],
): NormalizedDeliveryRow[] {
  const rowsByDuplicateKey = rows.reduce<Map<string, NormalizedDeliveryRow[]>>(
    (groups, row) => {
      if (!row.duplicateKey) {
        return groups;
      }

      groups.set(row.duplicateKey, [...(groups.get(row.duplicateKey) ?? []), row]);

      return groups;
    },
    new Map(),
  );
  const duplicateRowNumbers = new Set(
    [...rowsByDuplicateKey.values()]
      .filter((group) => group.length > 1)
      .flatMap((group) => group.map((row) => row.rowNumber)),
  );

  return rows.map((row) => {
    if (!duplicateRowNumbers.has(row.rowNumber)) {
      return {
        ...row,
        status: statusForIssues(row.issues),
      };
    }

    const hasDuplicateIssue = row.issues.some(
      (issue) => issue.code === "IMPORT_DUPLICATE_ROW",
    );
    const duplicateIssue: ImportValidationIssue = {
      code: "IMPORT_DUPLICATE_ROW",
      field: "file",
      message:
        "This row appears to duplicate another delivery with the same customer and address.",
      rowNumber: row.rowNumber,
      severity: "warning",
    };
    const issues = hasDuplicateIssue
      ? row.issues
      : [...row.issues, duplicateIssue];

    return {
      ...row,
      issues,
      status: statusForIssues(issues),
    };
  });
}

function optimizationLimitWarnings(
  rows: NormalizedDeliveryRow[],
): ImportValidationIssue[] {
  const importableRows = rows.filter((row) => row.status !== "invalid");

  if (importableRows.length <= MAX_OPTIMIZATION_STOPS) {
    return [];
  }

  return [
    {
      code: "IMPORT_EXCEEDS_OPTIMIZATION_LIMIT",
      field: "file",
      message: `This import has ${importableRows.length} usable rows. V1 optimization supports up to ${MAX_OPTIMIZATION_STOPS} delivery stops.`,
      severity: "warning",
    },
  ];
}

function statusForIssues(issues: ImportValidationIssue[]) {
  if (issues.some((issue) => issue.severity === "error")) {
    return "invalid" as const;
  }

  if (issues.some((issue) => issue.severity === "warning")) {
    return "warning" as const;
  }

  return "valid" as const;
}

function rowIssue({
  code,
  column,
  field,
  message,
  row,
}: {
  code: ImportIssueCode;
  column?: string;
  field: DeliveryImportField;
  message: string;
  row: ParsedDeliveryRow;
}): ImportValidationIssue {
  return {
    code,
    column,
    field,
    message,
    rowNumber: row.rowNumber,
    severity: "error",
  };
}

async function readUtf8Text(file: File) {
  const buffer = await file.arrayBuffer();

  try {
    return stripUtf8Bom(new TextDecoder("utf-8", { fatal: true }).decode(buffer));
  } catch {
    throw new DeliveryImportError(
      "IMPORT_ENCODING_ERROR",
      "The CSV file must use UTF-8 encoding.",
    );
  }
}

function normalizeImportedText(value: unknown) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .trim()
    .replace(/[ \t\r\n]+/g, " ");
}

function normalizeCell(value: unknown) {
  return normalizeImportedText(value);
}

function normalizeHeader(header: string) {
  return header
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function normalizeDuplicateText(value: string) {
  return normalizeHeader(value);
}

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);

  return hours * 60 + minutes;
}

function getSupportedFileType(fileName: string) {
  const normalizedName = fileName.toLowerCase().trim();

  if (normalizedName.endsWith(".csv")) {
    return "csv" as const;
  }

  if (normalizedName.endsWith(".xlsx")) {
    return "xlsx" as const;
  }

  return null;
}

function stripUtf8Bom(value: string) {
  return value.replace(/^\uFEFF/, "");
}

function hasXlsxZipSignature(value: ArrayBuffer) {
  const bytes = new Uint8Array(value);

  return bytes[0] === 0x50 && bytes[1] === 0x4b;
}

function createStableStopId(rowNumber: number, name: string, address?: string) {
  const slug = slugify(`${name}-${address ?? "missing-address"}`);
  const hash = stableHash(`${rowNumber}|${name}|${address ?? ""}`);

  return `imported-${rowNumber}-${slug}-${hash}`.slice(0, 96);
}

function makeUniqueStopId(baseId: string, usedIds: Set<string>) {
  let id = baseId;
  let suffix = 2;

  while (usedIds.has(id)) {
    id = `${baseId}-${suffix}`;
    suffix += 1;
  }

  usedIds.add(id);

  return id;
}

function stableHash(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
}

function slugify(value: string) {
  const slug = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "delivery";
}
