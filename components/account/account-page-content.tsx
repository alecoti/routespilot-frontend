"use client";

import { LogOut, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import {
  getAuthSession,
  logout,
  logoutAll,
  type AuthSession,
} from "@/lib/api/auth";

export function AccountPageContent() {
  const router = useRouter();
  const [session, setSession] = useState<AuthSession | null>(() => getAuthSession());
  const [busyAction, setBusyAction] = useState<"logout" | "logoutAll" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const displayEmail = useMemo(
    () => session?.user.email ?? "Signed in user",
    [session],
  );

  async function handleLogout() {
    setBusyAction("logout");
    setError(null);
    try {
      await logout();
      setSession(null);
      router.replace("/login");
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "Logout failed.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleLogoutAll() {
    setBusyAction("logoutAll");
    setError(null);
    try {
      await logoutAll();
      setSession(null);
      router.replace("/login");
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "Logout failed.");
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10">
      <div>
        <p className="font-display text-xs font-semibold uppercase text-muted-foreground">
          Account
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold text-foreground">
          User profile
        </h1>
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ShieldCheck aria-hidden className="h-5 w-5" />
          </span>
          <div>
            <p className="font-display text-sm font-semibold text-foreground">
              Signed in as
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{displayEmail}</p>
            {session?.organization.name ? (
              <p className="mt-3 text-xs text-muted-foreground">
                Workspace: {session.organization.name}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button
          className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 font-display text-sm font-semibold text-foreground transition-colors hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-60"
          disabled={busyAction !== null}
          onClick={handleLogout}
          type="button"
        >
          <LogOut aria-hidden className="h-4 w-4" />
          {busyAction === "logout" ? "Signing out..." : "Logout"}
        </button>
        <button
          className="inline-flex items-center gap-2 rounded-md bg-foreground px-4 py-2 font-display text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={busyAction !== null}
          onClick={handleLogoutAll}
          type="button"
        >
          <LogOut aria-hidden className="h-4 w-4" />
          {busyAction === "logoutAll" ? "Signing out..." : "Logout all sessions"}
        </button>
      </div>
    </section>
  );
}
