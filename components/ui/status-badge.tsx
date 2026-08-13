import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

export function StatusBadge({
  children,
  className,
  icon = false,
}: {
  children: React.ReactNode;
  className?: string;
  icon?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-primary-accent/20 bg-primary-accent/10 px-2.5 py-1 font-display text-xs font-semibold text-primary-accent",
        className,
      )}
    >
      {icon ? <Check aria-hidden className="h-3.5 w-3.5" /> : null}
      {children}
    </span>
  );
}
