"use client";

import { ArrowDown, ArrowUp } from "lucide-react";

import { cn } from "@/lib/utils";

export function ObjectiveRow({
  description,
  isLast,
  isFirst,
  label,
  meta,
  onMoveDown,
  onMoveUp,
  prefix,
}: {
  description: string;
  isFirst?: boolean;
  isLast?: boolean;
  label: string;
  meta?: string;
  onMoveDown?: () => void;
  onMoveUp?: () => void;
  prefix: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-container font-display text-sm font-semibold text-foreground">
        {prefix}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-sm font-semibold text-foreground">
          {label}
        </span>
        <span className="block text-sm leading-5 text-muted-foreground">
          {description}
        </span>
        {meta ? (
          <span className="mt-1 block text-xs font-medium text-muted-foreground">
            {meta}
          </span>
        ) : null}
      </span>
      {onMoveUp || onMoveDown ? (
        <span className="flex shrink-0 items-center gap-1">
          <button
            aria-label={`Move ${label} up`}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-foreground transition-colors hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-40",
            )}
            disabled={isFirst}
            onClick={onMoveUp}
            type="button"
          >
            <ArrowUp aria-hidden className="h-4 w-4" />
          </button>
          <button
            aria-label={`Move ${label} down`}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-foreground transition-colors hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-40"
            disabled={isLast}
            onClick={onMoveDown}
            type="button"
          >
            <ArrowDown aria-hidden className="h-4 w-4" />
          </button>
        </span>
      ) : null}
    </div>
  );
}
