import Link from "next/link";
import {
  Lightbulb,
  MapPin,
  Play,
  Route,
  Truck,
  Upload,
} from "lucide-react";

import { AppShell } from "@/components/app-shell/app-shell";
import { NewOptimizationLink } from "@/components/app-shell/new-optimization-link";
import { StatusBadge } from "@/components/ui/status-badge";
import { recentOptimizations } from "@/lib/mock-data";

export default function DashboardPage() {
  return (
    <AppShell active="history">
      <div className="mx-auto max-w-[1440px] px-4 py-8 md:px-6 md:py-10">
        <header className="mb-8">
          <h1 className="font-display text-3xl font-semibold text-foreground md:text-4xl">
            Good morning, Marco.
          </h1>
          <p className="mt-2 text-lg text-muted-foreground">
            What do you need to optimize today?
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <section className="relative flex min-h-80 flex-col justify-between overflow-hidden rounded-xl border border-border bg-card p-6 md:p-8">
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(16,185,129,0.08),transparent_45%)]" />
              <div className="relative">
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-primary-accent/10 text-primary-accent">
                  <Route aria-hidden className="h-6 w-6" strokeWidth={1.8} />
                </div>
                <h2 className="font-display text-2xl font-medium text-foreground">
                  New optimization
                </h2>
                <p className="mt-2 max-w-xl text-base leading-7 text-muted-foreground">
                  Create a new delivery route plan, assign vehicles, and
                  maximize efficiency for your fleet.
                </p>
              </div>

              <div className="relative mt-8 flex flex-col gap-4 sm:flex-row">
                <NewOptimizationLink
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-accent px-8 py-3 font-display text-sm font-bold text-primary-foreground"
                  href="/optimize"
                >
                  <Play aria-hidden className="h-4 w-4 fill-current" />
                  Start
                </NewOptimizationLink>
                <button className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-6 py-3 font-display text-sm font-medium text-foreground transition-colors hover:bg-surface-low">
                  <Upload aria-hidden className="h-4 w-4" />
                  Upload CSV
                </button>
              </div>
            </section>

            <section>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-display text-xs font-semibold uppercase text-muted-foreground">
                  Recent Optimizations
                </h3>
                <Link
                  className="font-display text-xs font-semibold text-primary"
                  href="/history"
                >
                  View all
                </Link>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {recentOptimizations.map((item) => (
                  <article
                    className="flex h-40 flex-col justify-between rounded-lg border border-border bg-card p-4 transition-colors hover:bg-surface-low"
                    key={item.name}
                  >
                    <div>
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <h4 className="truncate font-display text-sm font-bold text-foreground">
                          {item.name}
                        </h4>
                        <StatusBadge
                          className={
                            item.status === "Completed"
                              ? "border-transparent bg-surface-high text-muted-foreground"
                              : undefined
                          }
                        >
                          {item.status}
                        </StatusBadge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {item.date}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <MapPin aria-hidden className="h-4 w-4" />
                        {item.stops}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Truck aria-hidden className="h-4 w-4" />
                        {item.vehicles}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            <section className="rounded-xl border border-border bg-card p-5">
              <h3 className="font-display text-sm font-medium text-muted-foreground">
                Monthly Usage
              </h3>
              <div className="mb-2 mt-4 flex items-end justify-between">
                <span className="font-display text-4xl font-semibold text-foreground">
                  7
                </span>
                <span className="mb-1 text-sm text-muted-foreground">
                  / 20 optimizations
                </span>
              </div>
              <div className="mb-4 h-2 overflow-hidden rounded-full bg-surface-container">
                <div className="h-full w-[35%] rounded-full bg-primary-accent" />
              </div>
              <p className="text-sm text-muted-foreground">Resets in 12 days</p>
            </section>

            <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
              <div className="flex items-center gap-3">
                <Lightbulb
                  aria-hidden
                  className="h-5 w-5 text-primary-accent"
                  strokeWidth={1.8}
                />
                <h4 className="font-display text-sm font-bold text-foreground">
                  Pro Tip
                </h4>
              </div>
              <p className="text-sm leading-6 text-muted-foreground">
                Upload a CSV with predefined delivery time windows to let our AI
                automatically prioritize urgent stops.
              </p>
              <Link
                className="mt-auto font-display text-xs font-semibold text-primary"
                href="#"
              >
                Read the guide
              </Link>
            </section>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
