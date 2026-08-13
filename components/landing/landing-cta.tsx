"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";

import {
  captureAttribution,
  trackEvent,
  type CtaLocation,
} from "@/lib/analytics";
import { cn } from "@/lib/utils";

export function LandingCTA({
  children,
  compact = false,
  ctaLocation,
}: {
  children: ReactNode;
  compact?: boolean;
  ctaLocation: CtaLocation;
}) {
  return (
    <Link
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md bg-primary-accent font-display text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary",
        compact ? "px-4 py-2" : "px-6 py-3",
      )}
      href="/try"
      onClick={() => {
        captureAttribution();
        trackEvent("landing_primary_cta_clicked", {
          cta_location: ctaLocation,
        });
      }}
    >
      {children}
      <ArrowRight aria-hidden className="h-4 w-4" />
    </Link>
  );
}
