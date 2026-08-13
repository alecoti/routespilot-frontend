"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { getAnalyticsCorrelationId } from "@/lib/analytics";
import { startOpenReplay, type ReplaySurface } from "@/lib/replay";

export function ReplayProvider() {
  const pathname = usePathname();

  useEffect(() => {
    const surface = replaySurfaceForPath(pathname);
    if (!surface) {
      return;
    }
    void startOpenReplay({
      surface,
      user_state: "anonymous",
      analytics_correlation_id: getAnalyticsCorrelationId(),
    });
  }, [pathname]);

  return null;
}

function replaySurfaceForPath(pathname: string | null): ReplaySurface | null {
  if (pathname === "/") {
    return "landing";
  }
  if (pathname === "/try") {
    return "try";
  }
  if (pathname?.startsWith("/login")) {
    return "auth";
  }
  return null;
}
