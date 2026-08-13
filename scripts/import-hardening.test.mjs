import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

import ts from "typescript";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const fixtureDir = join(rootDir, "test-fixtures", "import");
const tempRoot = join(rootDir, ".tmp");
mkdirSync(tempRoot, { recursive: true });
const tempDir = mkdtempSync(join(tempRoot, "import-tests-"));
const compiledPath = join(tempDir, "delivery-import.cjs");
const capacityCompiledPath = join(tempDir, "capacity.cjs");
const sourcePath = join(rootDir, "lib", "import", "delivery-import.ts");
const capacitySourcePath = join(rootDir, "lib", "capacity.ts");

const source = readFileSync(sourcePath, "utf8").replace(
  "@/lib/capacity",
  "./capacity.cjs",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    esModuleInterop: true,
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
});
const capacityCompiled = ts.transpileModule(readFileSync(capacitySourcePath, "utf8"), {
  compilerOptions: {
    esModuleInterop: true,
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
});

writeFileSync(capacityCompiledPath, capacityCompiled.outputText);
writeFileSync(compiledPath, compiled.outputText);

const require = createRequire(import.meta.url);
const xlsx = require("xlsx");
const {
  DeliveryImportError,
  MAX_IMPORT_FILE_SIZE_MB,
  MAX_IMPORT_ROWS,
  MAX_OPTIMIZATION_STOPS,
  createDeliveryStops,
  detectColumns,
  normalizeOptionalTime,
  parseDecimalNumber,
  parseDeliveryFile,
} = require(compiledPath);

function arrayBufferFromBytes(bytes) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

function textFile(name, text, sizeOverride) {
  const bytes = new TextEncoder().encode(text);

  return {
    name,
    size: sizeOverride ?? bytes.byteLength,
    arrayBuffer: async () => arrayBufferFromBytes(bytes),
  };
}

function bytesFile(name, bytes) {
  return {
    name,
    size: bytes.byteLength,
    arrayBuffer: async () => arrayBufferFromBytes(bytes),
  };
}

function fixtureFile(name) {
  return textFile(name, readFileSync(join(fixtureDir, name), "utf8"));
}

function workbookFile(name, sheets) {
  const workbook = xlsx.utils.book_new();

  for (const sheet of sheets) {
    xlsx.utils.book_append_sheet(
      workbook,
      xlsx.utils.aoa_to_sheet(sheet.rows),
      sheet.name,
    );
  }

  return bytesFile(
    name,
    xlsx.write(workbook, { bookType: "xlsx", type: "buffer" }),
  );
}

function issueCodes(preview) {
  return preview.issues.map((issue) => issue.code);
}

function rowCodes(preview, rowNumber) {
  const row = preview.rows.find((candidate) => candidate.rowNumber === rowNumber);

  assert.ok(row, `Expected row ${rowNumber} to exist`);

  return row.issues.map((issue) => issue.code);
}

async function expectImportError(promise, code) {
  try {
    await promise;
  } catch (error) {
    assert.ok(error instanceof DeliveryImportError);
    assert.equal(error.code, code);
    return;
  }

  assert.fail(`Expected ${code}`);
}

try {
  assert.deepEqual(
    detectColumns([
      "Cliente",
      "Delivery Address",
      "Peso",
      "From",
      "To",
      "Service Minutes",
    ]),
    {
      name: "Cliente",
      address: "Delivery Address",
      demand: "Peso",
      timeWindowStart: "From",
      timeWindowEnd: "To",
      serviceTimeMinutes: "Service Minutes",
    },
  );

  assert.equal(parseDecimalNumber("120"), 120);
  assert.equal(parseDecimalNumber("120,5"), 120.5);
  assert.equal(parseDecimalNumber("120.5"), 120.5);
  assert.equal(parseDecimalNumber("1,200.5"), 1200.5);
  assert.equal(parseDecimalNumber("1.200,5"), 1200.5);
  assert.equal(parseDecimalNumber("12,3,4"), undefined);
  assert.equal(normalizeOptionalTime("8.30"), "08:30");
  assert.equal(normalizeOptionalTime("08:30"), "08:30");
  assert.equal(normalizeOptionalTime("25:00"), undefined);

  const clean = await parseDeliveryFile(fixtureFile("clean.csv"));
  assert.equal(clean.fileType, "csv");
  assert.equal(clean.validRowCount, 3);
  assert.equal(clean.invalidRowCount, 0);
  assert.equal(clean.warningRowCount, 0);
  assert.equal(clean.validRows[0].name, "Rossi SRL");
  assert.equal(clean.validRows[0].address, "Via Roma 24, Bologna");
  assert.equal(clean.validRows[0].demand, 120.5);
  assert.equal(clean.validRows[0].timeWindowStart, "08:30");
  assert.equal(clean.validRows[0].timeWindowEnd, "10:00");
  assert.equal(clean.validRows[0].serviceTimeMinutes, 15);
  assert.equal(clean.validRows[2].name, "Caffè Centrale");

  const cleanStops = createDeliveryStops(clean.validRows);
  assert.equal(cleanStops.stops.length, 3);
  assert.equal(cleanStops.stops[0].serviceTimeSeconds, 900);
  assert.equal(cleanStops.timeWindowCount, 3);

  const semicolon = await parseDeliveryFile(fixtureFile("semicolon.csv"));
  assert.equal(semicolon.validRowCount, 2);
  assert.equal(semicolon.validRows[0].demand, 120.5);
  assert.equal(semicolon.validRows[0].timeWindowStart, "08:00");
  assert.equal(semicolon.validRows[0].timeWindowEnd, "09:15");

  const messy = await parseDeliveryFile(fixtureFile("messy.csv"));
  assert.equal(messy.skippedRowCount, 1);
  assert.equal(messy.validRowCount, 4);
  assert.equal(messy.invalidRowCount, 8);
  assert.equal(messy.warningRowCount, 2);
  assert.ok(issueCodes(messy).includes("IMPORT_DUPLICATE_ROW"));
  assert.ok(rowCodes(messy, 2).includes("IMPORT_DUPLICATE_ROW"));
  assert.ok(rowCodes(messy, 4).includes("IMPORT_DUPLICATE_ROW"));
  assert.ok(rowCodes(messy, 5).includes("IMPORT_MISSING_ADDRESS"));
  assert.ok(rowCodes(messy, 6).includes("IMPORT_INVALID_NUMBER"));
  assert.ok(rowCodes(messy, 7).includes("IMPORT_NEGATIVE_DEMAND"));
  assert.ok(rowCodes(messy, 8).includes("IMPORT_INVALID_TIME"));
  assert.ok(rowCodes(messy, 9).includes("IMPORT_INCOMPLETE_TIME_WINDOW"));
  assert.ok(rowCodes(messy, 10).includes("IMPORT_INVALID_TIME_WINDOW_ORDER"));
  assert.ok(rowCodes(messy, 11).includes("IMPORT_INVALID_SERVICE_TIME"));
  assert.ok(rowCodes(messy, 12).includes("IMPORT_NEGATIVE_SERVICE_TIME"));
  assert.ok(!rowCodes(messy, 13).includes("IMPORT_DUPLICATE_ROW"));
  assert.ok(!rowCodes(messy, 14).includes("IMPORT_DUPLICATE_ROW"));

  const partialImport = createDeliveryStops(messy.validRows);
  assert.equal(partialImport.stops.length, messy.validRowCount);
  assert.ok(partialImport.stops.every((stop) => stop.address));
  assert.ok(!partialImport.stops.some((stop) => stop.name === "Bad Number"));

  const stableIds = createDeliveryStops(messy.validRows).stops.map(
    (stop) => stop.id,
  );
  const repeatedStableIds = createDeliveryStops(messy.validRows).stops.map(
    (stop) => stop.id,
  );
  assert.deepEqual(stableIds, repeatedStableIds);
  assert.equal(new Set(stableIds).size, stableIds.length);
  assert.notEqual(
    createDeliveryStops(messy.validRows, [stableIds[0]]).stops[0].id,
    stableIds[0],
  );

  const missingName = await parseDeliveryFile(
    textFile("missing-name.csv", "Address,Demand\nVia Test 1 Bologna,10\n"),
  );
  assert.equal(missingName.validRows[0].name, "Delivery row 2");
  assert.equal(missingName.validRowCount, 1);

  const missingAddressColumn = await parseDeliveryFile(
    textFile("missing-address-column.csv", "Customer,Demand\nRossi,10\n"),
  );
  assert.equal(missingAddressColumn.canImport, false);
  assert.deepEqual(missingAddressColumn.missingRequiredFields, ["address"]);
  assert.ok(
    issueCodes(missingAddressColumn).includes("IMPORT_MISSING_ADDRESS_COLUMN"),
  );

  const bom = await parseDeliveryFile(
    textFile("bom.csv", "\uFEFFCliente,Indirizzo\nAzienda,Via Test 2 Bologna\n"),
  );
  assert.equal(bom.validRowCount, 1);

  const workbook = workbookFile("deliveries.xlsx", [
    { name: "Empty", rows: [[], []] },
    {
      name: "Bologna",
      rows: [
        ["Cliente", "Indirizzo", "Peso"],
        ["Bologna Client", "Via Roma 1 Bologna", "10"],
      ],
    },
    {
      name: "Ferrara",
      rows: [
        ["Cliente", "Indirizzo"],
        ["Ferrara Client", "Via Ercole I d'Este 1 Ferrara"],
      ],
    },
  ]);
  const defaultSheet = await parseDeliveryFile(workbook);
  assert.equal(defaultSheet.sheetName, "Bologna");
  assert.deepEqual(defaultSheet.availableSheets, ["Bologna", "Ferrara"]);

  const selectedSheet = await parseDeliveryFile(workbook, {
    sheetName: "Ferrara",
  });
  assert.equal(selectedSheet.sheetName, "Ferrara");
  assert.equal(selectedSheet.validRows[0].name, "Ferrara Client");

  await expectImportError(
    parseDeliveryFile(textFile("unsupported.txt", "Cliente,Indirizzo\nA,B\n")),
    "IMPORT_UNSUPPORTED_FILE",
  );
  await expectImportError(
    parseDeliveryFile(
      textFile(
        "too-large.csv",
        "Cliente,Indirizzo\nA,B\n",
        MAX_IMPORT_FILE_SIZE_MB * 1024 * 1024 + 1,
      ),
    ),
    "IMPORT_FILE_TOO_LARGE",
  );
  await expectImportError(
    parseDeliveryFile(bytesFile("invalid.csv", new Uint8Array([0xff, 0xfe]))),
    "IMPORT_ENCODING_ERROR",
  );
  await expectImportError(
    parseDeliveryFile(bytesFile("broken.xlsx", new Uint8Array([1, 2, 3, 4]))),
    "IMPORT_MALFORMED_XLSX",
  );

  const tooManyRowsCsv = [
    "Cliente,Indirizzo",
    ...Array.from({ length: MAX_IMPORT_ROWS + 1 }, (_, index) => {
      const rowNumber = index + 1;

      return `Client ${rowNumber},Via Test ${rowNumber} Bologna`;
    }),
  ].join("\n");
  await expectImportError(
    parseDeliveryFile(textFile("too-many.csv", tooManyRowsCsv)),
    "IMPORT_TOO_MANY_ROWS",
  );

  const overOptimizationLimitCsv = [
    "Cliente,Indirizzo",
    ...Array.from({ length: MAX_OPTIMIZATION_STOPS + 1 }, (_, index) => {
      const rowNumber = index + 1;

      return `Client ${rowNumber},Via Test ${rowNumber} Bologna`;
    }),
  ].join("\n");
  const overOptimizationLimit = await parseDeliveryFile(
    textFile("over-limit.csv", overOptimizationLimitCsv),
  );
  assert.equal(overOptimizationLimit.canImport, true);
  assert.ok(
    issueCodes(overOptimizationLimit).includes(
      "IMPORT_EXCEEDS_OPTIMIZATION_LIMIT",
    ),
  );

  const performanceResults = [];

  for (const rowCount of [20, 50, MAX_IMPORT_ROWS]) {
    const rows = Array.from({ length: rowCount }, (_, index) => {
      const rowNumber = index + 1;

      return [
        `Client ${rowNumber}`,
        `Via Performance ${rowNumber} Bologna`,
        "1",
        "08:00",
        "18:00",
      ];
    });
    const csv = [
      "Cliente,Indirizzo,Peso,Dalle,Alle",
      ...rows.map((row) => row.join(",")),
    ].join("\n");
    const csvStartedAt = performance.now();
    const csvPreview = await parseDeliveryFile(
      textFile(`performance-${rowCount}.csv`, csv),
    );
    const csvElapsedMs = Math.round(performance.now() - csvStartedAt);
    const xlsxStartedAt = performance.now();
    const xlsxPreview = await parseDeliveryFile(
      workbookFile(`performance-${rowCount}.xlsx`, [
        {
          name: "Deliveries",
          rows: [["Cliente", "Indirizzo", "Peso", "Dalle", "Alle"], ...rows],
        },
      ]),
    );
    const xlsxElapsedMs = Math.round(performance.now() - xlsxStartedAt);

    assert.equal(csvPreview.validRowCount, rowCount);
    assert.equal(xlsxPreview.validRowCount, rowCount);
    performanceResults.push(`${rowCount}: CSV ${csvElapsedMs}ms, XLSX ${xlsxElapsedMs}ms`);
  }

  console.log(
    `Import hardening tests passed. Parse benchmark (${performanceResults.join("; ")}).`,
  );
} finally {
  rmSync(tempDir, { force: true, recursive: true });
}
