import type { Metadata } from "next";
import { Suspense } from "react";

import { TrialPage } from "@/components/trial/trial-page";

export const metadata: Metadata = {
  title: "Try RoutesPlan | Start A Route Plan",
  description:
    "Start describing or uploading a delivery plan before signing in. RoutesPlan saves your work when you continue.",
};

export default function TryPage() {
  return (
    <Suspense fallback={null}>
      <TrialPage />
    </Suspense>
  );
}
