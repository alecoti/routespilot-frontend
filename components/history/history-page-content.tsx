"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  Check,
  Copy,
  Download,
  FileSpreadsheet,
  FolderOpen,
  History,
  Loader2,
  RotateCcw,
  Search,
  X,
} from "lucide-react";

import {
  archiveOptimization,
  downloadHistoryExport,
  duplicateOptimization,
  getOptimizationHistoryDetail,
  listOptimizationHistory,
  renameOptimization,
  restoreOptimization,
  type ArchivedFilter,
  type OptimizationHistoryDetail,
  type OptimizationHistoryItem,
} from "@/lib/api/history";
import {
  hydrateConversation,
  storeConversationId,
} from "@/lib/api/conversations";
import { hasPersistenceContext } from "@/lib/api/persistence-context";
import { formatMoneyMinor } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { useOptimizationStore } from "@/providers/optimization-provider";

type LoadingAction =
  | "archive"
  | "detail"
  | "duplicate"
  | "export"
  | "rename"
  | "restore";

export function HistoryPageContent() {
  const router = useRouter();
  const setProblem = useOptimizationStore((state) => state.setProblem);
  const startNewOptimization = useOptimizationStore(
    (state) => state.startNewOptimization,
  );
  const setResult = useOptimizationStore((state) => state.setResult);
  const setOptimizationId = useOptimizationStore(
    (state) => state.setOptimizationId,
  );
  const setOptimizationStatus = useOptimizationStore(
    (state) => state.setOptimizationStatus,
  );
  const setRouteGeometries = useOptimizationStore(
    (state) => state.setRouteGeometries,
  );
  const setRouteGeometryError = useOptimizationStore(
    (state) => state.setRouteGeometryError,
  );
  const setDiagnostics = useOptimizationStore((state) => state.setDiagnostics);
  const persistenceConfigured = hasPersistenceContext();
  const [archived, setArchived] = useState<ArchivedFilter>("active");
  const [cursor, setCursor] = useState<string | undefined>();
  const [confirmingArchiveId, setConfirmingArchiveId] = useState<string | null>(
    null,
  );
  const [detail, setDetail] = useState<OptimizationHistoryDetail | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<OptimizationHistoryItem[]>([]);
  const [loading, setLoading] = useState(persistenceConfigured);
  const [loadingAction, setLoadingAction] = useState<{
    id: string;
    action: LoadingAction;
  } | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");

  const loadFirstPage = useCallback(async () => {
    setError(null);
    setLoading(true);
    setCursor(undefined);
    setDetail(null);

    try {
      const page = await listOptimizationHistory({
        archived,
        limit: 20,
        search: submittedSearch,
      });

      setItems(page.items);
      setCursor(page.nextCursor);
    } catch {
      setError("We couldn't load your optimization history.");
    } finally {
      setLoading(false);
    }
  }, [archived, submittedSearch]);

  useEffect(() => {
    if (!persistenceConfigured) {
      return;
    }

    const timeout = window.setTimeout(() => {
      void loadFirstPage();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [loadFirstPage, persistenceConfigured]);

  async function loadMore() {
    if (!cursor || loadingAction) {
      return;
    }

    setLoadingAction({ id: "page", action: "detail" });

    try {
      const page = await listOptimizationHistory({
        archived,
        cursor,
        limit: 20,
        search: submittedSearch,
      });

      setItems((current) => [...current, ...page.items]);
      setCursor(page.nextCursor);
    } catch {
      setError("We couldn't load more optimizations.");
    } finally {
      setLoadingAction(null);
    }
  }

  function handleSearchSubmit() {
    if (search.trim() === submittedSearch.trim()) {
      void loadFirstPage();
      return;
    }

    setSubmittedSearch(search);
  }

  async function openOptimization(item: OptimizationHistoryItem) {
    setLoadingAction({ id: item.id, action: "detail" });
    setError(null);

    try {
      const optimization = await getOptimizationHistoryDetail(item.id);

      if (!optimization.activeResult) {
        if (optimization.status === "pending") {
          const conversation = optimization.conversationId
            ? await hydrateConversation(optimization.conversationId).catch(
                () => null,
              )
            : null;

          if (conversation) {
            storeConversationId(conversation.session.id);
          }

          startNewOptimization({
            conversationSessionId:
              conversation?.session.id ?? `conversation_${optimization.id}`,
            messages: conversation?.messages,
            optimizationId: optimization.id,
            problem: conversation?.problem ?? optimization.problem,
          });
          router.push("/optimize");
          return;
        }

        setDetail(optimization);
        return;
      }

      setProblem(optimization.problem);
      setOptimizationId(optimization.id);
      setResult(optimization.activeResult);
      setOptimizationStatus(
        optimization.activeResult.feasible ? "completed" : "failed",
      );
      setDiagnostics(null);
      setRouteGeometries(optimization.routeGeometries);
      setRouteGeometryError(null);
      router.push("/results");
    } catch {
      setError("We couldn't reopen this optimization.");
    } finally {
      setLoadingAction(null);
    }
  }

  async function duplicateAndEdit(item: OptimizationHistoryItem) {
    setLoadingAction({ id: item.id, action: "duplicate" });
    setError(null);

    try {
      const problem = await duplicateOptimization(item.id);

      setProblem(problem);
      setOptimizationId(null);
      setResult(null);
      setDiagnostics(null);
      setRouteGeometries([]);
      setRouteGeometryError(null);
      setOptimizationStatus("idle");
      router.push("/review");
    } catch {
      setError("We couldn't duplicate this optimization.");
    } finally {
      setLoadingAction(null);
    }
  }

  async function saveRename(item: OptimizationHistoryItem) {
    setLoadingAction({ id: item.id, action: "rename" });
    setError(null);

    try {
      const renamed = await renameOptimization(item.id, renameValue);

      setItems((current) =>
        current.map((historyItem) =>
          historyItem.id === item.id
            ? { ...historyItem, name: renamed.name }
            : historyItem,
        ),
      );
      setDetail((current) =>
        current?.id === item.id ? { ...current, name: renamed.name } : current,
      );
      setEditingId(null);
    } catch {
      setError("We couldn't rename this optimization.");
    } finally {
      setLoadingAction(null);
    }
  }

  async function archiveOrRestore(item: OptimizationHistoryItem) {
    const action = archived === "archived" ? "restore" : "archive";

    if (action === "archive" && confirmingArchiveId !== item.id) {
      setConfirmingArchiveId(item.id);
      return;
    }

    setLoadingAction({ id: item.id, action });
    setError(null);

    try {
      if (action === "restore") {
        await restoreOptimization(item.id);
      } else {
        await archiveOptimization(item.id);
      }

      setItems((current) =>
        current.filter((historyItem) => historyItem.id !== item.id),
      );
      setDetail((current) => (current?.id === item.id ? null : current));
      setConfirmingArchiveId(null);
    } catch {
      setError(
        action === "restore"
          ? "We couldn't restore this optimization."
          : "We couldn't archive this optimization.",
      );
    } finally {
      setLoadingAction(null);
    }
  }

  const emptyMessage = useMemo(() => {
    if (!persistenceConfigured) {
      return {
        title: "History is not connected",
        body: "Set NEXT_PUBLIC_ROUTESPILOT_ORGANIZATION_ID to load persisted optimizations.",
      };
    }

    if (archived === "archived") {
      return {
        title: "No archived optimizations",
        body: "Archived route plans will appear here.",
      };
    }

    return {
      title: "No optimizations yet",
      body: "Create an optimization and it will appear here once persistence is configured.",
    };
  }, [archived, persistenceConfigured]);

  return (
    <div className="mx-auto flex max-w-[1440px] flex-col gap-6 px-4 py-8 md:px-6 md:py-10">
      <header className="flex flex-col justify-between gap-4 border-b border-border pb-4 lg:flex-row lg:items-end">
        <div>
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-surface">
            <History aria-hidden className="h-5 w-5 text-primary-accent" />
          </div>
          <h1 className="font-display text-3xl font-semibold text-foreground md:text-4xl">
            Optimization history
          </h1>
          <p className="mt-2 max-w-2xl text-base leading-7 text-muted-foreground">
            Reopen previous route plans, duplicate them for edits, or move old
            plans into the archive.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex rounded-lg border border-border bg-surface p-1">
            {(["active", "archived"] as const).map((value) => (
              <button
                className={cn(
                  "rounded-md px-3 py-2 font-display text-sm font-semibold text-muted-foreground transition-colors",
                  archived === value && "bg-card text-foreground shadow-sm",
                )}
                key={value}
                onClick={() => setArchived(value)}
                type="button"
              >
                {value === "active" ? "Active" : "Archived"}
              </button>
            ))}
          </div>
        </div>
      </header>

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 md:flex-row md:items-center">
        <label className="relative flex-1">
          <span className="sr-only">Search optimizations</span>
          <Search
            aria-hidden
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            className="h-11 w-full rounded-lg border border-border bg-background pl-10 pr-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary-accent"
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                handleSearchSubmit();
              }
            }}
            placeholder="Search by optimization name"
            type="search"
            value={search}
          />
        </label>
        <button
          className="inline-flex h-11 items-center justify-center rounded-lg bg-primary-accent px-4 font-display text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90"
          onClick={handleSearchSubmit}
          type="button"
        >
          Search
        </button>
      </section>

      {error ? (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex min-h-72 items-center justify-center rounded-lg border border-border bg-card">
          <Loader2
            aria-hidden
            className="h-5 w-5 animate-spin text-primary-accent"
          />
        </div>
      ) : items.length === 0 ? (
        <EmptyHistoryState title={emptyMessage.title} body={emptyMessage.body} />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
          <section className="grid gap-3">
            {items.map((item) => (
              <HistoryItemCard
                action={loadingAction?.id === item.id ? loadingAction.action : null}
                archivedView={archived === "archived"}
                confirmingArchive={confirmingArchiveId === item.id}
                editing={editingId === item.id}
                item={item}
                key={item.id}
                onArchiveRestore={() => void archiveOrRestore(item)}
                onCancelRename={() => setEditingId(null)}
                onCancelArchive={() => setConfirmingArchiveId(null)}
                onDuplicate={() => void duplicateAndEdit(item)}
                onOpen={() => void openOptimization(item)}
                onRenameChange={setRenameValue}
                onRenameStart={() => {
                  setEditingId(item.id);
                  setRenameValue(item.name ?? "");
                }}
                onRenameSubmit={() => void saveRename(item)}
                renameValue={renameValue}
              />
            ))}

            {cursor ? (
              <button
                className="inline-flex h-11 items-center justify-center rounded-lg border border-border bg-card px-4 font-display text-sm font-semibold text-foreground transition-colors hover:bg-surface-low disabled:cursor-not-allowed disabled:text-muted-foreground"
                disabled={Boolean(loadingAction)}
                onClick={() => void loadMore()}
                type="button"
              >
                {loadingAction?.id === "page" ? "Loading..." : "Load more"}
              </button>
            ) : null}
          </section>

          <HistoryDetailPanel
            detail={detail}
            onDownload={(format) =>
              detail ? void downloadHistoryExport(detail.id, format) : undefined
            }
            onDuplicate={(itemId) => {
              const item = items.find((historyItem) => historyItem.id === itemId);

              if (item) {
                void duplicateAndEdit(item);
              }
            }}
          />
        </div>
      )}
    </div>
  );
}

function HistoryItemCard({
  action,
  archivedView,
  confirmingArchive,
  editing,
  item,
  onCancelArchive,
  onArchiveRestore,
  onCancelRename,
  onDuplicate,
  onOpen,
  onRenameChange,
  onRenameStart,
  onRenameSubmit,
  renameValue,
}: {
  action: LoadingAction | null;
  archivedView: boolean;
  confirmingArchive: boolean;
  editing: boolean;
  item: OptimizationHistoryItem;
  onCancelArchive: () => void;
  onArchiveRestore: () => void;
  onCancelRename: () => void;
  onDuplicate: () => void;
  onOpen: () => void;
  onRenameChange: (value: string) => void;
  onRenameStart: () => void;
  onRenameSubmit: () => void;
  renameValue: string;
}) {
  return (
    <article className="rounded-lg border border-border bg-card p-4 transition-colors hover:bg-surface-low">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {editing ? (
              <div className="flex min-w-0 flex-1 gap-2">
                <label className="sr-only" htmlFor={`rename-${item.id}`}>
                  Optimization name
                </label>
                <input
                  className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary-accent"
                  id={`rename-${item.id}`}
                  onChange={(event) => onRenameChange(event.target.value)}
                  value={renameValue}
                />
                <button
                  aria-label="Save name"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary-accent text-primary-foreground"
                  disabled={action === "rename"}
                  onClick={onRenameSubmit}
                  type="button"
                >
                  <Check aria-hidden className="h-4 w-4" />
                </button>
                <button
                  aria-label="Cancel rename"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border text-muted-foreground"
                  onClick={onCancelRename}
                  type="button"
                >
                  <X aria-hidden className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <h2 className="truncate font-display text-lg font-semibold text-foreground">
                {item.name ?? "Untitled optimization"}
              </h2>
            )}
            <StatusPill status={item.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {formatDateTime(item.createdAt)}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <IconButton
            icon={<FolderOpen aria-hidden className="h-4 w-4" />}
            label={action === "detail" ? "Opening..." : "Open"}
            onClick={onOpen}
          />
          <IconButton
            icon={<Copy aria-hidden className="h-4 w-4" />}
            label={action === "duplicate" ? "Duplicating..." : "Duplicate"}
            onClick={onDuplicate}
          />
          <IconButton
            icon={<FileSpreadsheet aria-hidden className="h-4 w-4" />}
            label="Rename"
            onClick={onRenameStart}
          />
          <IconButton
            icon={
              archivedView ? (
                <RotateCcw aria-hidden className="h-4 w-4" />
              ) : (
                <Archive aria-hidden className="h-4 w-4" />
              )
            }
            label={
              action === "archive" || action === "restore"
                ? archivedView
                  ? "Restoring..."
                  : "Archiving..."
                : confirmingArchive
                  ? "Confirm archive"
                : archivedView
                  ? "Restore"
                  : "Archive"
            }
            onClick={onArchiveRestore}
          />
          {confirmingArchive ? (
            <IconButton
              icon={<X aria-hidden className="h-4 w-4" />}
              label="Cancel"
              onClick={onCancelArchive}
            />
          ) : null}
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-5">
        <Metric label="Stops" value={String(item.stopCount)} />
        <Metric label="Vehicles" value={String(item.vehicleCount)} />
        <Metric
          label="Distance"
          value={
            typeof item.totalDistanceMeters === "number"
              ? `${(item.totalDistanceMeters / 1000).toFixed(1)} km`
              : "-"
          }
        />
        <Metric
          label="Duration"
          value={
            typeof item.totalDurationSeconds === "number"
              ? formatDurationSeconds(item.totalDurationSeconds)
              : "-"
          }
        />
        <Metric
          label="Cost"
          value={formatMoneyMinor(item.estimatedCostMinor, item.currency ?? "EUR")}
        />
      </dl>
    </article>
  );
}

function HistoryDetailPanel({
  detail,
  onDownload,
  onDuplicate,
}: {
  detail: OptimizationHistoryDetail | null;
  onDownload: (format: "csv" | "xlsx" | "driver_sheet") => void;
  onDuplicate: (id: string) => void;
}) {
  if (!detail) {
    return (
      <aside className="hidden rounded-lg border border-border bg-card p-5 xl:block">
        <p className="font-display text-sm font-semibold text-foreground">
          Historical detail
        </p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Open a plan that could not produce route results to inspect its
          saved reason and duplicate it for editing.
        </p>
      </aside>
    );
  }

  return (
    <aside className="rounded-lg border border-border bg-card p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-foreground">
            {detail.name ?? "Untitled optimization"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {statusLabel(detail.status)}
          </p>
        </div>
        <StatusPill status={detail.status} />
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        <p className="font-display text-sm font-semibold text-foreground">
          Optimization could not be reopened as a route plan.
        </p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {detail.errorMessage ??
            "The saved optimization does not have an exportable active result."}
        </p>
      </div>

      {detail.variants.length > 0 ? (
        <div className="mt-4">
          <p className="mb-2 font-display text-xs font-semibold uppercase text-muted-foreground">
            Saved alternatives
          </p>
          <div className="space-y-2">
            {detail.variants.map((variant) => (
              <div
                className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
                key={variant.id}
              >
                <span className="font-medium text-foreground">
                  {planLabel(variant.planType)}
                </span>
                <span className="text-muted-foreground">
                  {variant.isSelected ? "Selected" : statusLabel(variant.status)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-5 flex flex-col gap-2">
        {detail.activeResult ? (
          <>
            <button
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 font-display text-sm font-semibold text-foreground transition-colors hover:bg-surface-low"
              onClick={() => onDownload("csv")}
              type="button"
            >
              <Download aria-hidden className="h-4 w-4" />
              CSV
            </button>
            <button
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 font-display text-sm font-semibold text-foreground transition-colors hover:bg-surface-low"
              onClick={() => onDownload("xlsx")}
              type="button"
            >
              <Download aria-hidden className="h-4 w-4" />
              Excel plan
            </button>
          </>
        ) : null}
        <button
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-accent px-4 py-2 font-display text-sm font-bold text-primary-foreground"
          onClick={() => onDuplicate(detail.id)}
          type="button"
        >
          <Copy aria-hidden className="h-4 w-4" />
          Duplicate and edit
        </button>
      </div>
    </aside>
  );
}

function EmptyHistoryState({ body, title }: { body: string; title: string }) {
  return (
    <section className="flex min-h-72 items-center rounded-lg border border-border bg-card p-6">
      <div className="max-w-xl">
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-surface">
          <History aria-hidden className="h-5 w-5 text-muted-foreground" />
        </div>
        <h2 className="font-display text-2xl font-semibold text-foreground">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
      </div>
    </section>
  );
}

function IconButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 font-display text-sm font-semibold text-foreground transition-colors hover:bg-surface-low"
      onClick={onClick}
      type="button"
    >
      {icon}
      {label}
    </button>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-display text-sm font-semibold text-foreground">
        {value}
      </dd>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2.5 py-1 font-display text-xs font-semibold",
        status === "completed" &&
          "border-primary-accent/20 bg-primary-accent/10 text-primary-accent",
        status === "processing" &&
          "border-warning/20 bg-warning/10 text-warning",
        status === "infeasible" &&
          "border-warning/20 bg-warning/10 text-warning",
        status === "time_limit" &&
          "border-warning/20 bg-warning/10 text-warning",
        status === "failed" &&
          "border-destructive/20 bg-destructive/10 text-destructive",
        status === "pending" &&
          "border-border bg-surface text-muted-foreground",
      )}
    >
      {statusLabel(status)}
    </span>
  );
}

function statusLabel(status: string) {
  switch (status) {
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
    case "infeasible":
      return "No feasible plan";
    case "processing":
      return "Optimizing";
    case "time_limit":
      return "Time limit reached";
    case "pending":
      return "Queued";
    default:
      return "Unavailable";
  }
}

function planLabel(planType: string) {
  switch (planType) {
    case "lowest_cost":
      return "Lowest cost";
    case "shortest":
      return "Shortest";
    case "balanced":
      return "Balanced";
    case "fastest":
      return "Fastest";
    default:
      return planType.replaceAll("_", " ");
  }
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDurationSeconds(seconds: number) {
  const minutes = Math.round(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return hours > 0 ? `${hours}h ${remainingMinutes}m` : `${remainingMinutes}m`;
}
