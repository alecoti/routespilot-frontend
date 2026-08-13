import type { Metadata } from "next";
import Script from "next/script";
import { Geist, Inter } from "next/font/google";
import "./globals.css";

import { ReplayProvider } from "@/components/replay/replay-provider";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://routesplan.eu"),
  title: "RoutesPlan",
  description: "AI-assisted route optimization for small delivery fleets",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const umamiEnabled =
    process.env.NEXT_PUBLIC_UMAMI_ENABLED?.trim().toLowerCase() === "true";
  const umamiScriptUrl = process.env.NEXT_PUBLIC_UMAMI_SCRIPT_URL;
  const umamiWebsiteId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;

  return (
    <html lang="en" className={`${geist.variable} ${inter.variable}`}>
      <body>
        {umamiEnabled && umamiScriptUrl && umamiWebsiteId ? (
          <Script
            data-do-not-track="true"
            data-website-id={umamiWebsiteId}
            defer
            src={umamiScriptUrl}
            strategy="afterInteractive"
          />
        ) : null}
        <ReplayProvider />
        {children}
      </body>
    </html>
  );
}
