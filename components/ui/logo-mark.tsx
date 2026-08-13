import { Route } from "lucide-react";

export function LogoMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-high text-primary">
        <Route aria-hidden className="h-4 w-4" strokeWidth={1.8} />
      </div>
      {!compact ? (
        <div>
          <p className="font-display text-lg font-bold leading-none text-primary">
            RoutesPlan
          </p>
          <p className="mt-1 text-xs font-semibold leading-none text-muted-foreground">
            Fleet Management
          </p>
        </div>
      ) : null}
    </div>
  );
}
