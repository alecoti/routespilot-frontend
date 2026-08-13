"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, Plus, X } from "lucide-react";

import { getAuthSession } from "@/lib/api/auth";
import { adminNavItems, navItems } from "@/lib/navigation";
import { LogoMark } from "@/components/ui/logo-mark";
import { NewOptimizationLink } from "@/components/app-shell/new-optimization-link";

export function MobileNavigation() {
  const [open, setOpen] = useState(false);
  const [isInternalAdmin, setIsInternalAdmin] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setIsInternalAdmin(Boolean(getAuthSession()?.isInternalAdmin));
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 flex h-16 items-center justify-between border-b border-border bg-surface px-4 md:hidden">
        <LogoMark compact />
        <button
          aria-label="Open navigation"
          className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-surface-container hover:text-foreground"
          onClick={() => setOpen(true)}
          type="button"
        >
          <Menu aria-hidden className="h-5 w-5" />
        </button>
      </header>

      {open ? (
        <div className="fixed inset-0 z-50 bg-foreground/20 md:hidden">
          <div className="flex h-full w-72 flex-col border-r border-border bg-background p-4">
            <div className="mb-8 flex items-center justify-between">
              <LogoMark />
              <button
                aria-label="Close navigation"
                className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-surface-container hover:text-foreground"
                onClick={() => setOpen(false)}
                type="button"
              >
                <X aria-hidden className="h-5 w-5" />
              </button>
            </div>

            <NewOptimizationLink
              className="mb-6 flex items-center justify-center gap-2 rounded-lg bg-primary-accent px-4 py-3 font-display text-sm font-bold text-primary-foreground"
              href="/optimize"
              onClick={() => setOpen(false)}
            >
              <Plus aria-hidden className="h-4 w-4" />
              New Optimization
            </NewOptimizationLink>

            <nav className="flex flex-col gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;

                return (
                  <Link
                    className="flex items-center gap-3 rounded-md px-3 py-2 font-display text-sm font-medium text-muted-foreground transition-colors hover:bg-surface-container hover:text-foreground"
                    href={item.href}
                    key={item.key}
                    onClick={() => setOpen(false)}
                  >
                    <Icon aria-hidden className="h-5 w-5" strokeWidth={1.7} />
                    {item.label}
                  </Link>
                );
              })}
              {isInternalAdmin ? (
                <>
                  <p className="mt-5 px-3 pb-2 font-display text-[11px] font-semibold uppercase text-muted-foreground">
                    Admin
                  </p>
                  {adminNavItems.map((item) => {
                    const Icon = item.icon;

                    return (
                      <Link
                        className="flex items-center gap-3 rounded-md px-3 py-2 font-display text-sm font-medium text-muted-foreground transition-colors hover:bg-surface-container hover:text-foreground"
                        href={item.href}
                        key={item.key}
                        onClick={() => setOpen(false)}
                      >
                        <Icon
                          aria-hidden
                          className="h-5 w-5"
                          strokeWidth={1.7}
                        />
                        {item.label}
                      </Link>
                    );
                  })}
                </>
              ) : null}
            </nav>
          </div>
        </div>
      ) : null}
    </>
  );
}
