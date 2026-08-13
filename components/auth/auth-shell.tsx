import type { ReactNode } from "react";

import { LogoMark } from "@/components/ui/logo-mark";

type AuthShellProps = {
  children: ReactNode;
  eyebrow?: string;
  subtitle: string;
  title: string;
  variant?: "login" | "secure";
};

export function AuthShell({
  children,
  subtitle,
  title,
  variant = "login",
}: AuthShellProps) {
  return (
    <main className="grid min-h-screen bg-card text-foreground lg:grid-cols-[0.94fr_1.06fr]">
      <AuthVisualPanel subtitle={subtitle} title={title} variant={variant} />
      <section className="flex min-h-screen items-center justify-center bg-card px-6 py-12 sm:px-10">
        <div className="w-full max-w-[380px]">{children}</div>
      </section>
    </main>
  );
}

function AuthVisualPanel({
  subtitle,
  title,
  variant,
}: {
  subtitle: string;
  title: string;
  variant: "login" | "secure";
}) {
  return (
    <aside className="relative hidden min-h-screen overflow-hidden border-r border-border bg-[linear-gradient(115deg,#f8f8f9_0%,#efeff0_58%,#e7e8e9_100%)] px-8 py-10 lg:flex">
      <div className="absolute inset-0 opacity-80">
        <RouteGraph variant={variant} />
      </div>
      <div className="relative z-10 flex h-full w-full flex-col">
        <LogoMark />
        <div className="mt-auto max-w-[440px] pb-10">
          <h1 className="font-display text-[2.55rem] font-semibold leading-[1.08] tracking-normal text-foreground">
            {title}
          </h1>
          <p className="mt-6 max-w-[360px] text-base leading-7 text-foreground/80">
            {subtitle}
          </p>
        </div>
      </div>
    </aside>
  );
}

function RouteGraph({ variant }: { variant: "login" | "secure" }) {
  const primaryPath =
    variant === "secure"
      ? "M-30 520 L115 400 L265 570 L380 360 L540 190"
      : "M-20 500 L92 345 L220 430 L355 140 L520 -10";
  const secondaryPath =
    variant === "secure"
      ? "M92 580 L150 510 L215 610 L280 450 L430 215"
      : "M70 615 L132 535 L210 650 L330 520 L450 350";

  return (
    <svg
      aria-hidden
      className="h-full w-full"
      preserveAspectRatio="none"
      viewBox="0 0 560 720"
    >
      <defs>
        <filter id="auth-node-glow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="11" result="blur" />
          <feColorMatrix
            in="blur"
            type="matrix"
            values="0 0 0 0 0.07 0 0 0 0 0.72 0 0 0 0 0.49 0 0 0 0.35 0"
          />
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id="auth-route-line" x1="0%" x2="100%" y1="0%" y2="100%">
          <stop offset="0%" stopColor="#d8d9dc" />
          <stop offset="45%" stopColor="#b7f7dd" />
          <stop offset="100%" stopColor="#00b879" />
        </linearGradient>
      </defs>
      <path
        d={primaryPath}
        fill="none"
        stroke="url(#auth-route-line)"
        strokeLinecap="round"
        strokeWidth="3"
      />
      <path
        d={secondaryPath}
        fill="none"
        opacity="0.35"
        stroke="#a7f3d0"
        strokeDasharray="8 16"
        strokeLinecap="round"
        strokeWidth="3"
      />
      <path
        d="M-20 220 L145 90 L290 270 L590 40"
        fill="none"
        opacity="0.24"
        stroke="#c6c8cb"
        strokeLinecap="round"
        strokeWidth="2"
      />
      {[
        [92, 345, 13],
        [220, 430, 15],
        [355, 140, 16],
        [150, 510, 13],
        [215, 610, 15],
        [145, 90, 6],
        [290, 270, 7],
      ].map(([cx, cy, r], index) => (
        <circle
          cx={cx}
          cy={cy}
          fill={index < 5 ? "#b7f7dd" : "#d8d9dc"}
          filter={index < 5 ? "url(#auth-node-glow)" : undefined}
          key={`${cx}-${cy}`}
          opacity={index < 5 ? "0.85" : "0.55"}
          r={r}
        />
      ))}
    </svg>
  );
}
