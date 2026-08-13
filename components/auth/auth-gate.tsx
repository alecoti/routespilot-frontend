"use client";

import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";

import {
  AUTH_SESSION_EXPIRED_EVENT,
  fetchCurrentAuthSession,
} from "@/lib/api/auth";

type AuthGateProps = {
  children: ReactNode;
};

export function AuthGate({ children }: AuthGateProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [status, setStatus] = useState<"loading" | "ready">("loading");

  useEffect(() => {
    let cancelled = false;

    function redirectToLogin() {
      const next = pathname ? `?next=${encodeURIComponent(pathname)}` : "";
      router.replace(`/login${next}`);
    }

    function handleExpiredSession() {
      setStatus("loading");
      redirectToLogin();
    }

    window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, handleExpiredSession);

    async function hydrateAuth() {
      try {
        await fetchCurrentAuthSession();
        if (!cancelled) {
          setStatus("ready");
        }
      } catch {
        if (!cancelled) {
          redirectToLogin();
        }
      }
    }

    hydrateAuth();

    return () => {
      cancelled = true;
      window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, handleExpiredSession);
    };
  }, [pathname, router]);

  if (status === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-card text-foreground">
        <div className="h-8 w-8 rounded-full border-2 border-border border-t-primary" />
      </main>
    );
  }

  return children;
}
