"use client";

import { useEffect, useState } from "react";
import { Plus, UserCircle } from "lucide-react";
import Link from "next/link";

import { adminNavItems, navItems, type NavKey } from "@/lib/navigation";
import { getAuthSession } from "@/lib/api/auth";
import { cn } from "@/lib/utils";
import { LogoMark } from "@/components/ui/logo-mark";
import { NewOptimizationLink } from "@/components/app-shell/new-optimization-link";

export function AppSidebar({ active }: { active?: NavKey }) {
  const [isInternalAdmin, setIsInternalAdmin] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setIsInternalAdmin(Boolean(getAuthSession()?.isInternalAdmin));
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  return (
    <aside className="fixed left-0 top-0 z-40 hidden h-full w-[var(--sidebar-width)] flex-col border-r border-border bg-background px-4 py-6 md:flex">
      <div className="mb-8 px-2">
        <LogoMark />
      </div>

      <NewOptimizationLink
        className="mb-8 flex w-full items-center justify-center gap-2 rounded-lg bg-primary-accent px-4 py-3 font-display text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90"
        href="/optimize"
      >
        <Plus aria-hidden className="h-4 w-4" />
        New Optimization
      </NewOptimizationLink>

      <nav className="flex flex-1 flex-col gap-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.key;

          return (
            <Link
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 font-display text-sm font-medium text-muted-foreground transition-colors hover:bg-surface-container hover:text-foreground",
                isActive &&
                  "border-l-2 border-primary bg-surface-low pl-2.5 font-bold text-primary",
              )}
              href={item.href}
              key={item.key}
            >
              <Icon aria-hidden className="h-5 w-5" strokeWidth={1.7} />
              {item.label}
            </Link>
          );
        })}

        {isInternalAdmin ? (
          <div className="mt-5 border-t border-border pt-4">
            <p className="px-3 pb-2 font-display text-[11px] font-semibold uppercase text-muted-foreground">
              Admin
            </p>
            {adminNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = active === item.key;

              return (
                <Link
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 font-display text-sm font-medium text-muted-foreground transition-colors hover:bg-surface-container hover:text-foreground",
                    isActive &&
                      "border-l-2 border-primary bg-surface-low pl-2.5 font-bold text-primary",
                  )}
                  href={item.href}
                  key={item.key}
                >
                  <Icon aria-hidden className="h-5 w-5" strokeWidth={1.7} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ) : null}
      </nav>

      <div className="mt-auto border-t border-border pt-4">
        <Link
          className="flex items-center gap-3 rounded-md px-3 py-2 font-display text-sm font-medium text-muted-foreground transition-colors hover:bg-surface-container hover:text-foreground"
          href="/account"
        >
          <UserCircle aria-hidden className="h-5 w-5" strokeWidth={1.7} />
          User Profile
        </Link>
      </div>
    </aside>
  );
}
