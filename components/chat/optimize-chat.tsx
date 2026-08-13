"use client";

import { useEffect, useRef, useState } from "react";

import {
  createDeliveryStops,
  createImportPreview,
  DeliveryImportError,
  parseDeliveryFile,
} from "@/lib/import/delivery-import";
import type {
  ImportColumnMapping,
  ImportPreview,
} from "@/lib/import/delivery-import-types";
import type { ImportedFileState } from "@/lib/conversation-types";
import type { DeliveryStop } from "@/lib/types";
import { ensureConversationSession } from "@/lib/api/conversations";
import { saveOptimizationDraft } from "@/lib/api/history";
import { hasPersistenceContext } from "@/lib/api/persistence-context";
import {
  composeImportReadinessMessage,
  composeImportReadinessNote,
} from "@/lib/conversation-engine";
import { traceRoutingDebug } from "@/lib/routing-debug";
import {
  useOptimizationStore,
  useOptionalOptimizationStoreApi,
} from "@/providers/optimization-provider";
import { ChatComposer } from "@/components/chat/chat-composer";
import { ConversationWorkspace } from "@/components/chat/conversation-workspace";
import { DeliveryImportPreview } from "@/components/chat/delivery-import-preview";

export function OptimizeChat() {
  const hasHydratedConversation = useRef(false);
  const scrollAnchorRef = useRef<HTMLDivElement>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importMode, setImportMode] = useState<"replace" | "append">("replace");
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isParsingFile, setIsParsingFile] = useState(false);
  const storeApi = useOptionalOptimizationStoreApi();
  const conversationSessionId = useOptimizationStore(
    (state) => state.conversationSessionId,
  );
  const previousConversationSessionId = useRef(conversationSessionId);
  const hydrateConversation = useOptimizationStore(
    (state) => state.hydrateConversation,
  );
  const messages = useOptimizationStore((state) => state.messages);
  const setResult = useOptimizationStore((state) => state.setResult);
  const problem = useOptimizationStore((state) => state.problem);
  const optimizationId = useOptimizationStore((state) => state.optimizationId);
  const importedFile = useOptimizationStore((state) => state.importedFile);
  const clearImportedFileState = useOptimizationStore(
    (state) => state.clearImportedFileState,
  );
  const setImportedFileState = useOptimizationStore(
    (state) => state.setImportedFileState,
  );
  const addAssistantConversationMessage = useOptimizationStore(
    (state) => state.addAssistantConversationMessage,
  );
  const setStops = useOptimizationStore((state) => state.setStops);
  const updateProblem = useOptimizationStore((state) => state.updateProblem);

  useEffect(() => {
    if (previousConversationSessionId.current === conversationSessionId) {
      return;
    }

    previousConversationSessionId.current = conversationSessionId;
    setImportFile(null);
    setImportMode("replace");
    setImportPreview(null);
    setImportError(null);
    setIsParsingFile(false);
  }, [conversationSessionId]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      scrollAnchorRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [
    messages.length,
    isParsingFile,
    importError,
    importPreview?.fileName,
    importPreview?.rowCount,
    importedFile?.id,
    importedFile?.status,
  ]);

  useEffect(() => {
    if (hasHydratedConversation.current) {
      return;
    }

    hasHydratedConversation.current = true;
    const requestedState = storeApi?.getState();
    const requestedConversationSessionId = requestedState?.conversationSessionId;
    const requestedConversationRevision = requestedState?.conversationRevision;
    traceRoutingDebug("HYDRATION_START", {
      conversationId: requestedConversationSessionId,
      optimizationId: requestedState?.optimizationId,
      problem: requestedState?.problem ?? problem,
      revision: requestedConversationRevision,
    });

    void ensureConversationSession({
      initialAssistantMessage: messages[0]?.content,
      problem,
    })
      .then((payload) => {
        if (!payload) {
          return;
        }

        const activeConversationSessionId =
          storeApi?.getState().conversationSessionId;
        const activeConversationRevision =
          storeApi?.getState().conversationRevision;
        traceRoutingDebug("HYDRATION_PAYLOAD", {
          conversationId: payload.session.id,
          optimizationId: payload.session.optimizationId,
          problem: payload.problem,
          revision: activeConversationRevision,
          extra: {
            activeConversationSessionId,
            requestedConversationSessionId,
            requestedConversationRevision,
          },
        });

        if (
          activeConversationSessionId &&
          requestedConversationSessionId &&
          activeConversationSessionId !== requestedConversationSessionId &&
          activeConversationSessionId !== payload.session.id
        ) {
          traceStaleHydration({
            activeConversationSessionId,
            payloadConversationSessionId: payload.session.id,
            requestedConversationSessionId,
          });
          traceRoutingDebug("HYDRATION_SKIPPED_SESSION_CHANGED", {
            conversationId: activeConversationSessionId,
            optimizationId: payload.session.optimizationId,
            problem: storeApi?.getState().problem,
            revision: activeConversationRevision,
            extra: {
              payloadConversationSessionId: payload.session.id,
              requestedConversationSessionId,
            },
          });
          return;
        }

        if (
          typeof requestedConversationRevision === "number" &&
          typeof activeConversationRevision === "number" &&
          activeConversationRevision !== requestedConversationRevision
        ) {
          hydrateConversation({
            conversationSessionId: payload.session.id,
            messages: [],
            optimizationId: payload.session.optimizationId,
            revision: payload.revision,
          });

          const activeProblem = storeApi?.getState().problem;

          if (
            activeProblem &&
            payload.session.optimizationId &&
            hasPersistenceContext()
          ) {
            void saveOptimizationDraft(
              payload.session.optimizationId,
              activeProblem,
            ).catch(() => {
              if (process.env.NEXT_PUBLIC_CONVERSATION_DEBUG === "true") {
                console.info("[CONVERSATION HYDRATE] Draft resync failed");
              }
            });
          }

          traceStaleHydration({
            activeConversationSessionId: activeConversationSessionId ?? null,
            payloadConversationSessionId: payload.session.id,
            requestedConversationSessionId,
          });
          traceRoutingDebug("HYDRATION_SKIPPED_REVISION_CHANGED", {
            conversationId: payload.session.id,
            optimizationId: payload.session.optimizationId,
            problem: activeProblem,
            revision: activeConversationRevision,
            extra: {
              payloadProblem: payload.problem
                ? {
                    stops: payload.problem.stops.length,
                    vehicles: payload.problem.vehicles.length,
                  }
                : null,
              requestedConversationRevision,
            },
          });
          return;
        }

        traceConversationHydration({
          activeConversationSessionId,
          payloadConversationSessionId: payload.session.id,
          requestedConversationSessionId,
        });
        hydrateConversation({
          conversationSessionId: payload.session.id,
          messages: payload.messages,
          optimizationId: payload.session.optimizationId,
          problem: payload.problem,
          revision: payload.revision,
        });
      })
      .catch(() => {
        // Local non-persistent chat remains available when the DB-backed
        // conversation service is unavailable in development.
      });
  }, [hydrateConversation, messages, problem, storeApi]);

  async function handleFileSelected(file: File) {
    const fileConversationSessionId = storeApi?.getState().conversationSessionId;
    traceRoutingDebug("IMPORT_FILE_SELECTED", {
      conversationId: fileConversationSessionId,
      optimizationId: storeApi?.getState().optimizationId,
      problem: storeApi?.getState().problem,
      revision: storeApi?.getState().conversationRevision,
      extra: {
        fileName: file.name,
        fileSize: file.size,
      },
    });

    setImportError(null);
    setImportFile(file);
    setImportMode("replace");
    setImportPreview(null);
    setIsParsingFile(true);
    setImportedFileState({
      id: createImportedFileId(file),
      fileName: file.name,
      status: "parsing",
    });

    try {
      const preview = await parseDeliveryFile(file);

      if (!isCurrentConversation(storeApi, fileConversationSessionId)) {
        traceStaleImport({
          activeConversationSessionId: storeApi?.getState().conversationSessionId,
          requestedConversationSessionId: fileConversationSessionId,
        });
        return;
      }

      setImportPreview(preview);
      setImportedFileState(importedFileStateFromPreview(preview));
      traceRoutingDebug("IMPORT_PREVIEW_READY", {
        conversationId: fileConversationSessionId,
        optimizationId: storeApi?.getState().optimizationId,
        problem: storeApi?.getState().problem,
        revision: storeApi?.getState().conversationRevision,
        extra: {
          detectedCapacityDimensions: preview.detectedCapacityDimensions.map(
            (dimension) => dimension.key,
          ),
          fileName: preview.fileName,
          validRows: preview.validRowCount,
        },
      });
    } catch (error) {
      if (!isCurrentConversation(storeApi, fileConversationSessionId)) {
        return;
      }

      const message =
        error instanceof DeliveryImportError
          ? error.message
          : "I couldn't read that file.";

      setImportError(message);
      setImportedFileState({
        id: createImportedFileId(file),
        fileName: file.name,
        status: "failed",
        error: message,
      });
    } finally {
      setIsParsingFile(false);
    }
  }

  async function handleSheetChange(sheetName: string) {
    if (!importFile) {
      return;
    }

    const fileConversationSessionId = storeApi?.getState().conversationSessionId;

    setImportError(null);
    setIsParsingFile(true);
    setImportedFileState(
      importFile
        ? {
            id: createImportedFileId(importFile),
            fileName: importFile.name,
            status: "parsing",
          }
        : null,
    );

    try {
      const preview = await parseDeliveryFile(importFile, { sheetName });

      if (!isCurrentConversation(storeApi, fileConversationSessionId)) {
        traceStaleImport({
          activeConversationSessionId: storeApi?.getState().conversationSessionId,
          requestedConversationSessionId: fileConversationSessionId,
        });
        return;
      }

      setImportPreview(preview);
      setImportedFileState(importedFileStateFromPreview(preview));
    } catch (error) {
      if (!isCurrentConversation(storeApi, fileConversationSessionId)) {
        return;
      }

      const message =
        error instanceof DeliveryImportError
          ? error.message
          : "I couldn't read that worksheet.";

      setImportError(message);
      setImportedFileState({
        id: createImportedFileId(importFile),
        fileName: importFile.name,
        status: "failed",
        error: message,
      });
    } finally {
      setIsParsingFile(false);
    }
  }

  function handleMappingChange(mapping: ImportColumnMapping) {
    setImportPreview((currentPreview) => {
      if (!currentPreview) {
        return currentPreview;
      }

      return createImportPreview({
        fileName: currentPreview.fileName,
        fileType: currentPreview.fileType,
        availableSheets: currentPreview.availableSheets,
        headers: currentPreview.headers,
        mapping,
        parsedRows: currentPreview.sourceRows,
        sheetName: currentPreview.sheetName,
        skippedRows: currentPreview.skippedRows,
      });
    });
  }

  function handleImport() {
    if (!importPreview || !importPreview.canImport) {
      return;
    }

    const activeProblem = storeApi?.getState().problem ?? problem;
    const existingStops = activeProblem.stops;
    const imported = createDeliveryStops(
      importPreview.validRows,
      importMode === "append" ? existingStops.map((stop) => stop.id) : [],
    );
    const nextStops: DeliveryStop[] =
      importMode === "append" ? [...existingStops, ...imported.stops] : imported.stops;
    const activeConversationId = storeApi?.getState().conversationSessionId;
    traceRoutingDebug("IMPORT_COMMIT_BEFORE", {
      conversationId: activeConversationId,
      importedFile: storeApi?.getState().importedFile,
      optimizationId,
      problem: activeProblem,
      revision: storeApi?.getState().conversationRevision,
      extra: {
        importMode,
        nextStopCount: nextStops.length,
      },
    });

    if (process.env.NEXT_PUBLIC_CONVERSATION_DEBUG === "true") {
      console.info("[CONVERSATION IMPORT] IMPORT_CANONICAL_STATE", {
        conversationId: activeConversationId,
        importMode,
        optimizationId,
        problemId: activeProblem.id,
        stopCount: nextStops.length,
        vehicleCount: activeProblem.vehicles.length,
        vehicles: activeProblem.vehicles.map((vehicle) => vehicle.name),
      });
    }

    const nextCapacityDimensions =
      importPreview.detectedCapacityDimensions.length > 0
        ? mergeCapacityDimensions(
            activeProblem.capacityDimensions ?? [],
            importPreview.detectedCapacityDimensions,
          )
        : activeProblem.capacityDimensions;

    if (importPreview.detectedCapacityDimensions.length > 0) {
      updateProblem({
        capacityDimensions: nextCapacityDimensions,
      });
    }

    setStops(nextStops);
    setResult(null);
    const problemAfterImport = {
      ...activeProblem,
      capacityDimensions: nextCapacityDimensions,
      stops: nextStops,
    };
    const importReadinessNote = composeImportReadinessNote(problemAfterImport);
    setImportedFileState({
      id: importFile ? createImportedFileId(importFile) : `import_${Date.now()}`,
      fileName: importPreview.fileName,
      status: "success",
      rowCount: importPreview.totalRows,
      validRowCount: importPreview.validRowCount,
      importedStopIds: imported.stops.map((stop) => stop.id),
      warnings:
        [
          ...(importPreview.warningRowCount > 0
            ? [`${importPreview.warningRowCount} rows imported with warnings.`]
            : []),
          ...(importReadinessNote ? [importReadinessNote] : []),
        ],
    });
    addAssistantConversationMessage(
      composeImportReadinessMessage(problemAfterImport, {
        fileName: importPreview.fileName,
        importedStopCount: nextStops.length,
      }),
    );
    setImportPreview(null);
    setImportFile(null);
    setImportError(null);
    traceRoutingDebug("IMPORT_COMMIT_AFTER", {
      conversationId: storeApi?.getState().conversationSessionId,
      importedFile: storeApi?.getState().importedFile,
      optimizationId: storeApi?.getState().optimizationId,
      problem: storeApi?.getState().problem,
      revision: storeApi?.getState().conversationRevision,
    });

    if (optimizationId && hasPersistenceContext()) {
      traceRoutingDebug("IMPORT_DRAFT_AUTOSAVE_REQUEST", {
        conversationId: activeConversationId,
        optimizationId,
        problem: {
          ...problemAfterImport,
        },
        revision: storeApi?.getState().conversationRevision,
      });
      void saveOptimizationDraft(optimizationId, problemAfterImport).catch(() => {
        if (process.env.NEXT_PUBLIC_CONVERSATION_DEBUG === "true") {
          console.info("[CONVERSATION IMPORT] Draft autosave failed");
        }
      });
    }
  }

  function clearImportPreview() {
    setImportFile(null);
    setImportPreview(null);
    setImportError(null);
    clearImportedFileState();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="scrollbar-soft flex min-h-0 w-full flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-7 px-6 py-8 pb-8 md:px-10 md:py-10 md:pb-10">
          <ConversationWorkspace />

          {importedFile && !importPreview && !isParsingFile ? (
            <ImportedFileCard importedFile={importedFile} />
          ) : null}

          {isParsingFile ? (
            <ImportStatusCard
              description="RoutesPilot is reading columns, rows and delivery fields."
              title="Reading delivery file"
            />
          ) : null}

          {importError ? (
            <ImportStatusCard
              description={importError}
              tone="error"
              title="File import failed"
            />
          ) : null}

          {importPreview ? (
            <DeliveryImportPreview
              key={`${importPreview.fileName}-${importPreview.sheetName ?? "csv"}-${importPreview.rowCount}`}
              existingStopCount={problem.stops.length}
              importMode={importMode}
              onClear={clearImportPreview}
              onImport={handleImport}
              onImportModeChange={setImportMode}
              onMappingChange={handleMappingChange}
              onSheetChange={handleSheetChange}
              preview={importPreview}
            />
          ) : null}

          <div ref={scrollAnchorRef} />
        </div>
      </div>

      <div className="shrink-0 bg-[linear-gradient(to_top,var(--card)_72%,rgba(255,255,255,0))] px-6 pb-8 pt-6 md:px-8 md:pb-10 md:pt-8">
        <div className="flex justify-center">
          <ChatComposer
            isFileImporting={isParsingFile}
            onFileSelected={handleFileSelected}
          />
        </div>
      </div>
    </div>
  );
}

function importedFileStateFromPreview(preview: ImportPreview): ImportedFileState {
  return {
    id: `${preview.fileName}:${preview.sheetName ?? "default"}:${preview.totalRows}`,
    fileName: preview.fileName,
    status:
      preview.missingRequiredFields.length > 0
        ? "needs_mapping"
        : preview.invalidRowCount > 0 || preview.warningRowCount > 0
          ? "needs_review"
          : "needs_review",
    rowCount: preview.totalRows,
    validRowCount: preview.validRowCount,
    warnings:
      preview.warningRowCount > 0
        ? [`${preview.warningRowCount} rows have warnings.`]
        : [],
  };
}

function createImportedFileId(file: File) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

function ImportedFileCard({
  importedFile,
}: {
  importedFile: ImportedFileState;
}) {
  return (
    <div className="mx-auto w-full max-w-2xl rounded-xl border border-border bg-surface-low p-4 text-sm leading-6 shadow-[0_4px_12px_rgba(0,0,0,0.03)]">
      <p className="font-display text-xs font-semibold uppercase text-muted-foreground">
        File import
      </p>
      <p className="mt-2 font-display text-sm font-medium text-foreground">
        {importedFile.fileName}
      </p>
      <p className="mt-1 text-muted-foreground">
        {formatImportedFileStatus(importedFile)}
      </p>
      {importedFile.warnings?.length ? (
        <div className="mt-3 space-y-1 text-muted-foreground">
          {importedFile.warnings.map((warning, index) => (
            <p key={`${warning}-${index}`}>{warning}</p>
          ))}
        </div>
      ) : null}
      {importedFile.error ? <p className="mt-2">{importedFile.error}</p> : null}
    </div>
  );
}

function ImportStatusCard({
  description,
  title,
  tone = "neutral",
}: {
  description: string;
  title: string;
  tone?: "neutral" | "error";
}) {
  return (
    <div className="mx-auto w-full max-w-2xl rounded-xl border border-border bg-surface-low p-4 text-sm leading-6 shadow-[0_4px_12px_rgba(0,0,0,0.03)]">
      <p className="font-display text-xs font-semibold uppercase text-muted-foreground">
        File import
      </p>
      <p className="mt-2 font-display text-sm font-medium text-foreground">
        {title}
      </p>
      <p
        className={
          tone === "error" ? "mt-1 text-destructive" : "mt-1 text-muted-foreground"
        }
      >
        {description}
      </p>
    </div>
  );
}

function formatImportedFileStatus(importedFile: ImportedFileState) {
  if (importedFile.status === "success") {
    return `${importedFile.validRowCount ?? 0} deliveries loaded.`;
  }

  if (importedFile.status === "failed") {
    return "File import failed.";
  }

  if (importedFile.status === "needs_mapping") {
    return "Column mapping needs review.";
  }

  if (importedFile.status === "needs_review") {
    return `${importedFile.validRowCount ?? 0} valid deliveries ready to import.`;
  }

  return "Reading delivery file...";
}

function mergeCapacityDimensions(
  current: NonNullable<ImportPreview["detectedCapacityDimensions"]>,
  detected: ImportPreview["detectedCapacityDimensions"],
) {
  const byKey = new Map(current.map((dimension) => [dimension.key, dimension]));

  detected.forEach((dimension) => {
    byKey.set(dimension.key, dimension);
  });

  return [...byKey.values()];
}

function isCurrentConversation(
  storeApi: ReturnType<typeof useOptionalOptimizationStoreApi>,
  conversationSessionId?: string,
) {
  return (
    !storeApi ||
    !conversationSessionId ||
    storeApi.getState().conversationSessionId === conversationSessionId
  );
}

function traceConversationHydration({
  activeConversationSessionId,
  payloadConversationSessionId,
  requestedConversationSessionId,
}: {
  activeConversationSessionId?: string;
  payloadConversationSessionId: string;
  requestedConversationSessionId?: string;
}) {
  if (process.env.NEXT_PUBLIC_CONVERSATION_DEBUG !== "true") {
    return;
  }

  console.info("[CONVERSATION HYDRATE]", {
    activeConversationSessionId,
    payloadConversationSessionId,
    requestedConversationSessionId,
  });
}

function traceStaleHydration({
  activeConversationSessionId,
  payloadConversationSessionId,
  requestedConversationSessionId,
}: {
  activeConversationSessionId?: string | null;
  payloadConversationSessionId: string;
  requestedConversationSessionId?: string;
}) {
  if (process.env.NEXT_PUBLIC_CONVERSATION_DEBUG !== "true") {
    return;
  }

  console.info("[CONVERSATION HYDRATE] Stale hydration ignored", {
    activeConversationSessionId,
    payloadConversationSessionId,
    requestedConversationSessionId,
  });
}

function traceStaleImport({
  activeConversationSessionId,
  requestedConversationSessionId,
}: {
  activeConversationSessionId?: string;
  requestedConversationSessionId?: string;
}) {
  if (process.env.NEXT_PUBLIC_CONVERSATION_DEBUG !== "true") {
    return;
  }

  console.info("[CONVERSATION IMPORT] Stale file parse ignored", {
    activeConversationSessionId,
    requestedConversationSessionId,
  });
}
