import type { Metadata } from "next";

import { LandingPage } from "@/components/landing/landing-page";

export const metadata: Metadata = {
  title: "RoutesPlan | Delivery Route Planning In Minutes",
  description:
    "RoutesPlan helps small delivery fleets turn spreadsheets and real-world delivery instructions into optimized route plans with maps and exports.",
  alternates: {
    canonical: "https://routesplan.eu",
  },
  openGraph: {
    title: "RoutesPlan | Plan tomorrow's deliveries in minutes",
    description:
      "Upload your spreadsheet or describe the route problem. RoutesPlan helps build a validated delivery plan and calculates optimized routes.",
    siteName: "RoutesPlan",
    type: "website",
    url: "https://routesplan.eu",
  },
  twitter: {
    card: "summary_large_image",
    title: "RoutesPlan | Delivery Route Planning In Minutes",
    description:
      "An AI logistics planner for small delivery fleets that turns delivery lists into optimized route plans.",
  },
};

export default function Home() {
  return <LandingPage />;
}
