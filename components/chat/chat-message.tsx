import { ArrowRight, Route } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

export function UserMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] whitespace-pre-line rounded-2xl rounded-tr-md border border-border bg-surface-low px-4 py-3 text-[15px] leading-6 text-foreground shadow-[0_4px_12px_rgba(0,0,0,0.03)]">
        {children}
      </div>
    </div>
  );
}

export function AssistantMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-start" aria-live="polite">
      <div className="flex w-full max-w-[760px] gap-3">
        <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-container text-primary">
          <Route aria-hidden className="h-4 w-4" strokeWidth={1.8} />
        </div>
        <div className="flex w-full flex-col gap-3 text-[15px] leading-6 text-foreground">
          {children}
        </div>
      </div>
    </div>
  );
}

export function QuickReplies({
  active,
  replies,
}: {
  active?: string;
  replies: string[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {replies.map((reply) => (
        <button
          className={cn(
            "rounded-full border border-border bg-surface px-4 py-2 font-display text-sm font-medium text-foreground transition-colors hover:bg-surface-container",
            active === reply && "border-foreground bg-foreground text-card",
          )}
          key={reply}
          type="button"
        >
          {reply}
        </button>
      ))}
    </div>
  );
}

export function ReviewRouteButton() {
  return (
    <Link
      className="inline-flex w-fit items-center gap-2 rounded-full bg-primary px-6 py-3 font-display text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
      href="/review"
    >
      Problem preview
      <ArrowRight aria-hidden className="h-4 w-4" />
    </Link>
  );
}
