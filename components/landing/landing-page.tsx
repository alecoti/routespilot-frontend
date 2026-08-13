import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import {
  Bot,
  Building2,
  Check,
  ChevronDown,
  CircleAlert,
  Clock3,
  Map,
  PackageCheck,
  Route,
  ShieldCheck,
  SlidersHorizontal,
  Truck,
  Upload,
} from "lucide-react";

import { LogoMark } from "@/components/ui/logo-mark";
import { LandingCTA } from "@/components/landing/landing-cta";
import { cn } from "@/lib/utils";

const pains = [
  {
    title: "Too many variables",
    copy: "Vehicles, capacities, delivery windows and priorities quickly become difficult to combine by hand.",
    icon: SlidersHorizontal,
  },
  {
    title: "Plans change",
    copy: "A customer timing change, unavailable vehicle or extra stop can force the whole plan to be rebuilt.",
    icon: Clock3,
  },
  {
    title: "Routing tools can be too rigid",
    copy: "Many systems expect you to configure the routing problem before they can help solve it.",
    icon: CircleAlert,
  },
];

const steps = [
  {
    title: "Tell RoutesPlan what needs to happen",
    copy: "Describe the plan naturally or upload CSV/XLSX with your stops.",
    icon: Upload,
  },
  {
    title: "Build the planning problem together",
    copy: "RoutesPlan understands vehicles, capacities, time windows and priorities, then asks when something important is unclear.",
    icon: Bot,
  },
  {
    title: "Get optimized routes",
    copy: "The optimization engine calculates the plan and gives you routes, map and exportable results.",
    icon: Route,
  },
];

const useCases = [
  {
    title: "Local distribution",
    copy: "Plan daily rounds across local customers with several vehicles, time windows and capacity limits.",
    icon: Building2,
  },
  {
    title: "Food, beverage and wholesale",
    copy: "Turn customer orders into practical vehicle routes while respecting loads and delivery timing.",
    icon: PackageCheck,
  },
  {
    title: "Parts and trade suppliers",
    copy: "Handle changing daily orders, different load sizes and urgent stops without rebuilding the plan manually.",
    icon: Truck,
  },
  {
    title: "Delivery fleets",
    copy: "Give dispatchers a faster way to move from delivery list to route plan, map and export.",
    icon: Map,
  },
];

const capabilities = [
  "Multiple vehicles",
  "Weight, pallet and capacity constraints",
  "Time windows",
  "Required and optional stops",
  "Cost and priority objectives",
  "CSV/XLSX upload",
  "Route maps",
  "PDF and export output",
];

const faqs = [
  {
    question: "Do I need to configure a routing model?",
    answer:
      "No. You can describe the delivery problem or upload your file. RoutesPlan helps turn that into a structured route plan.",
  },
  {
    question: "Can I upload Excel or CSV?",
    answer:
      "Yes. RoutesPlan can import CSV/XLSX delivery lists and use the columns it recognizes.",
  },
  {
    question: "Can it handle multiple vehicles and capacities?",
    answer:
      "Yes. RoutesPlan supports multiple vehicles and capacity limits such as weight, volume, pallets and packages where your plan needs them.",
  },
  {
    question: "What happens if information is missing?",
    answer:
      "RoutesPlan asks for the missing details that matter before optimization, instead of silently guessing.",
  },
  {
    question: "Does the AI choose the routes?",
    answer:
      "No. AI helps understand and structure the planning problem. The route plan is calculated by the optimization engine.",
  },
  {
    question: "Do I need a credit card?",
    answer: "No credit card is required during early access.",
  },
  {
    question: "Can I export the plan?",
    answer:
      "Yes. RoutesPlan supports exportable route plans, including driver-ready outputs where available.",
  },
];

export function LandingPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <LandingNavbar />
      <HeroSection />
      <PainSection />
      <HowItWorksSection />
      <DifferenceSection />
      <AITrustSection />
      <UseCasesSection />
      <CapabilitiesSection />
      <FAQSection />
      <FinalCTASection />
      <LandingFooter />
    </main>
  );
}

function LandingNavbar() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-6">
        <Link
          aria-label="RoutesPlan home"
          className="rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
          href="/"
        >
          <LogoMark />
        </Link>

        <nav
          aria-label="Landing navigation"
          className="hidden items-center gap-8 font-display text-sm font-medium text-muted-foreground md:flex"
        >
          <a
            className="transition-colors hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
            href="#how-it-works"
          >
            How it works
          </a>
          <a
            className="transition-colors hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
            href="#use-cases"
          >
            Use cases
          </a>
        </nav>

        <div className="flex items-center gap-2">
          <Link
            className="hidden rounded-md px-3 py-2 font-display text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary sm:inline-flex"
            href="/login"
          >
            Sign in
          </Link>
          <LandingCTA compact ctaLocation="navbar">
            Try free
          </LandingCTA>
        </div>
      </div>
    </header>
  );
}

function HeroSection() {
  return (
    <section className="border-b border-border bg-card">
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-12 md:px-6 md:py-16 lg:grid-cols-[0.92fr_1.08fr] lg:py-20">
        <div>
          <p className="inline-flex rounded-full border border-primary-accent/20 bg-primary-accent/10 px-3 py-1 font-display text-xs font-semibold text-primary">
            Free during early access
          </p>
          <h1 className="mt-6 max-w-3xl font-display text-4xl font-semibold leading-tight text-foreground md:text-6xl">
            Plan tomorrow&apos;s deliveries in minutes.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
            Upload your spreadsheet or describe what needs to happen.
            RoutesPlan&apos;s AI logistics planner understands vehicles,
            capacities, time windows and priorities, then prepares an optimized
            route plan.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <LandingCTA ctaLocation="hero">Try RoutesPlan free</LandingCTA>
            <p className="text-sm text-muted-foreground">
              No credit card. About 2 minutes to get started.
            </p>
          </div>
        </div>

        <ProductDemo />
      </div>
    </section>
  );
}

function ProductDemo() {
  return (
    <div
      aria-label="RoutesPlan product preview showing conversation, planning state and route map"
      className="overflow-hidden rounded-lg border border-border bg-background shadow-[0_18px_60px_rgba(26,28,29,0.08)]"
      role="img"
    >
      <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary-accent/10 text-primary">
            <Route aria-hidden className="h-4 w-4" />
          </span>
          <div>
            <p className="font-display text-sm font-semibold text-foreground">
              New route plan
            </p>
            <p className="text-xs text-muted-foreground">Ready for review</p>
          </div>
        </div>
        <span className="rounded-full border border-primary-accent/20 bg-primary-accent/10 px-2.5 py-1 font-display text-xs font-semibold text-primary">
          Optimized routes
        </span>
      </div>

      <div className="grid lg:grid-cols-[1fr_260px]">
        <div className="border-b border-border bg-card p-4 lg:border-b-0 lg:border-r">
          <div className="space-y-3">
            <div className="ml-auto max-w-[86%] rounded-md bg-surface-container px-4 py-3 text-sm leading-6 text-foreground">
              I have 3 vans and 24 deliveries tomorrow. Rossi needs delivery
              before 11.
            </div>
            <div className="rounded-md border border-border bg-background px-4 py-3 text-sm leading-6 text-foreground">
              <div className="mb-2 flex items-center gap-2 font-display text-xs font-semibold text-primary">
                <Bot aria-hidden className="h-3.5 w-3.5" />
                RoutesPlan
              </div>
              I imported 24 deliveries. Two addresses need clarification before
              I optimize.
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <DemoStat label="Deliveries" value="24" />
            <DemoStat label="Vehicles" value="3" />
            <DemoStat label="Time windows" value="18" />
            <DemoStat label="Need review" value="2" tone="warning" />
          </div>

          <div className="mt-5 rounded-md border border-border bg-surface-low p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="font-display text-sm font-semibold text-foreground">
                Route map
              </p>
              <p className="text-xs text-muted-foreground">Map and export ready</p>
            </div>
            <RoutePreviewMap />
          </div>
        </div>

        <aside className="bg-surface p-4">
          <p className="font-display text-xs font-semibold uppercase text-muted-foreground">
            Route plan
          </p>
          <div className="mt-4 space-y-4">
            {[
              ["Route", "Depot configured"],
              ["Deliveries", "24 stops"],
              ["Vehicles", "3 vans"],
              ["Requirements", "18 time windows"],
              ["Optimization", "Time, distance"],
            ].map(([label, value]) => (
              <div
                className="flex items-start justify-between gap-3 border-b border-border pb-3 last:border-b-0"
                key={label}
              >
                <div>
                  <p className="font-display text-xs font-semibold text-muted-foreground">
                    {label}
                  </p>
                  <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
                </div>
                <Check aria-hidden className="mt-0.5 h-4 w-4 text-primary-accent" />
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

function DemoStat({
  label,
  tone = "normal",
  value,
}: {
  label: string;
  tone?: "normal" | "warning";
  value: string;
}) {
  return (
    <div className="border-l-2 border-primary pl-3">
      <p
        className={cn(
          "font-display text-2xl font-semibold leading-none",
          tone === "warning" ? "text-warning-text" : "text-foreground",
        )}
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function RoutePreviewMap() {
  return (
    <div className="relative h-52 overflow-hidden rounded-md border border-border bg-card">
      <div className="absolute inset-0 grid grid-cols-4 grid-rows-3">
        {Array.from({ length: 12 }).map((_, index) => (
          <span className="border-r border-t border-surface-high" key={index} />
        ))}
      </div>
      <span className="absolute left-[13%] top-[70%] h-2.5 w-2.5 rounded-full bg-primary" />
      <span className="absolute left-[31%] top-[48%] h-2.5 w-2.5 rounded-full bg-primary-accent" />
      <span className="absolute left-[58%] top-[57%] h-2.5 w-2.5 rounded-full bg-primary-accent" />
      <span className="absolute left-[76%] top-[24%] h-2.5 w-2.5 rounded-full bg-primary-accent" />
      <span className="absolute left-[84%] top-[63%] h-3 w-3 rounded-full bg-foreground" />
      <span className="absolute left-[14%] top-[68%] h-[2px] w-[24%] origin-left rotate-[-37deg] bg-primary" />
      <span className="absolute left-[32%] top-[49%] h-[2px] w-[27%] origin-left rotate-[9deg] bg-primary" />
      <span className="absolute left-[58%] top-[57%] h-[2px] w-[24%] origin-left rotate-[-48deg] bg-primary" />
      <span className="absolute left-[76%] top-[26%] h-[2px] w-[30%] origin-left rotate-[54deg] bg-primary" />
      <span className="absolute bottom-3 right-3 rounded-full bg-card px-2 py-1 text-xs font-medium text-foreground shadow-sm">
        Depot
      </span>
    </div>
  );
}

function PainSection() {
  return (
    <LandingSection
      eyebrow="Planning reality"
      intro="Manual planning works until the day has too many moving parts."
      title="Still planning routes with spreadsheets and maps?"
    >
      <div className="grid gap-4 md:grid-cols-3">
        {pains.map((pain) => (
          <InfoCard
            copy={pain.copy}
            icon={pain.icon}
            key={pain.title}
            title={pain.title}
          />
        ))}
      </div>
    </LandingSection>
  );
}

function HowItWorksSection() {
  return (
    <LandingSection
      eyebrow="How it works"
      id="how-it-works"
      intro="RoutesPlan keeps the normal path simple: describe the job, review the plan, optimize."
      title="From delivery list to route plan."
    >
      <div className="grid gap-4 lg:grid-cols-3">
        {steps.map((step, index) => (
          <div
            className="rounded-lg border border-border bg-card p-5"
            key={step.title}
          >
            <div className="flex items-center justify-between gap-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary-accent/10 text-primary">
                <step.icon aria-hidden className="h-5 w-5" />
              </span>
              <span className="font-display text-sm font-semibold text-muted-foreground">
                0{index + 1}
              </span>
            </div>
            <h3 className="mt-5 font-display text-lg font-semibold text-foreground">
              {step.title}
            </h3>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {step.copy}
            </p>
          </div>
        ))}
      </div>
      <CTAInline />
    </LandingSection>
  );
}

function DifferenceSection() {
  return (
    <LandingSection
      eyebrow="Why it is different"
      intro="RoutesPlan reduces setup work before optimization starts."
      title="A different kind of route planner."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <ComparisonPanel
          items={[
            "Fill forms",
            "Configure constraints",
            "Clean import data",
            "Choose settings",
            "Calculate",
          ]}
          title="Traditional route optimizer"
        />
        <ComparisonPanel
          highlight
          items={[
            "Describe the real situation",
            "Upload what you already have",
            "Answer useful questions",
            "Optimize when the plan is ready",
          ]}
          title="RoutesPlan"
        />
      </div>
      <p className="mt-6 font-display text-lg font-semibold text-primary">
        Less setup. More usable route plans.
      </p>
    </LandingSection>
  );
}

function AITrustSection() {
  return (
    <section className="border-y border-border bg-card">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-14 md:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:py-20">
        <div>
          <p className="font-display text-xs font-semibold uppercase text-muted-foreground">
            AI and reliability
          </p>
          <h2 className="mt-3 font-display text-3xl font-semibold leading-tight text-foreground md:text-4xl">
            AI that understands. Optimization you can rely on.
          </h2>
        </div>
        <div>
          <p className="max-w-3xl text-base leading-7 text-muted-foreground">
            RoutesPlan uses AI to understand what you are trying to plan and
            to help structure the problem. Once the delivery plan is ready, a
            dedicated optimization engine calculates the routes.
          </p>
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {[
              "AI helps with setup and clarification.",
              "The route plan is calculated by the optimization engine.",
              "RoutesPlan tells you when important information is missing.",
            ].map((item) => (
              <div
                className="flex gap-3 rounded-lg border border-border bg-background p-4"
                key={item}
              >
                <ShieldCheck
                  aria-hidden
                  className="mt-0.5 h-4 w-4 shrink-0 text-primary-accent"
                />
                <p className="text-sm leading-6 text-muted-foreground">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function UseCasesSection() {
  return (
    <LandingSection
      eyebrow="Use cases"
      id="use-cases"
      intro="For teams that already deliver every day and need a faster way to plan the next one."
      title="Built for everyday delivery planning."
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {useCases.map((useCase) => (
          <InfoCard
            copy={useCase.copy}
            icon={useCase.icon}
            key={useCase.title}
            title={useCase.title}
          />
        ))}
      </div>
    </LandingSection>
  );
}

function CapabilitiesSection() {
  return (
    <LandingSection
      eyebrow="Capability proof"
      intro="RoutesPlan handles real planning details, not just pins on a map."
      title="Real planning details, not just pins on a map."
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {capabilities.map((capability) => (
          <div
            className="flex items-center gap-3 rounded-md border border-border bg-card px-4 py-3"
            key={capability}
          >
            <Check aria-hidden className="h-4 w-4 shrink-0 text-primary-accent" />
            <p className="text-sm font-medium text-foreground">{capability}</p>
          </div>
        ))}
      </div>
    </LandingSection>
  );
}

function FAQSection() {
  return (
    <LandingSection
      eyebrow="FAQ"
      intro="Short answers to the questions people usually have before trying RoutesPlan."
      title="What to know before you start."
    >
      <div className="mx-auto max-w-3xl divide-y divide-border rounded-lg border border-border bg-card">
        {faqs.map((faq) => (
          <details className="group" key={faq.question}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-display text-sm font-semibold text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-primary">
              {faq.question}
              <ChevronDown
                aria-hidden
                className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
              />
            </summary>
            <p className="px-5 pb-5 text-sm leading-6 text-muted-foreground">
              {faq.answer}
            </p>
          </details>
        ))}
      </div>
    </LandingSection>
  );
}

function FinalCTASection() {
  return (
    <section className="px-4 py-14 md:px-6 lg:py-20">
      <div className="mx-auto max-w-5xl rounded-lg border border-border bg-card px-6 py-10 text-center md:px-10">
        <h2 className="font-display text-3xl font-semibold leading-tight text-foreground md:text-4xl">
          See what tomorrow&apos;s routes could look like.
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
          Upload your deliveries or describe the problem. RoutesPlan will help
          structure it and tell you if anything important is missing before
          calculating.
        </p>
        <div className="mt-7 flex flex-col items-center justify-center gap-3">
          <LandingCTA ctaLocation="final">Try RoutesPlan free</LandingCTA>
          <p className="text-sm text-muted-foreground">No credit card.</p>
        </div>
      </div>
    </section>
  );
}

function LandingFooter() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between md:px-6">
        <LogoMark compact />
        <nav aria-label="Footer navigation" className="flex flex-wrap gap-5">
          <Link className="hover:text-foreground" href="/login">
            Sign in
          </Link>
        </nav>
      </div>
    </footer>
  );
}

function LandingSection({
  children,
  eyebrow,
  id,
  intro,
  title,
}: {
  children: ReactNode;
  eyebrow: string;
  id?: string;
  intro: string;
  title: string;
}) {
  return (
    <section className="px-4 py-14 md:px-6 lg:py-20" id={id}>
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 max-w-3xl">
          <p className="font-display text-xs font-semibold uppercase text-muted-foreground">
            {eyebrow}
          </p>
          <h2 className="mt-3 font-display text-3xl font-semibold leading-tight text-foreground md:text-4xl">
            {title}
          </h2>
          <p className="mt-4 text-base leading-7 text-muted-foreground">{intro}</p>
        </div>
        {children}
      </div>
    </section>
  );
}

function InfoCard({
  copy,
  icon: Icon,
  title,
}: {
  copy: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: string;
}) {
  return (
    <article className="rounded-lg border border-border bg-card p-5">
      <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary-accent/10 text-primary">
        <Icon aria-hidden className="h-5 w-5" />
      </span>
      <h3 className="mt-5 font-display text-lg font-semibold text-foreground">
        {title}
      </h3>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{copy}</p>
    </article>
  );
}

function ComparisonPanel({
  highlight = false,
  items,
  title,
}: {
  highlight?: boolean;
  items: string[];
  title: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-5",
        highlight ? "border-primary-accent/40" : "border-border",
      )}
    >
      <h3
        className={cn(
          "font-display text-lg font-semibold",
          highlight ? "text-primary" : "text-foreground",
        )}
      >
        {title}
      </h3>
      <ul className="mt-5 space-y-3">
        {items.map((item) => (
          <li className="flex gap-3 text-sm text-muted-foreground" key={item}>
            <Check
              aria-hidden
              className={cn(
                "mt-0.5 h-4 w-4 shrink-0",
                highlight ? "text-primary-accent" : "text-muted-foreground",
              )}
            />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function CTAInline() {
  return (
    <div className="mt-8 flex flex-col gap-3 rounded-lg border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-display text-lg font-semibold text-foreground">
          Ready to try it on a real route?
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Start with a spreadsheet or a plain-language route description.
        </p>
      </div>
      <LandingCTA compact ctaLocation="mid_page">
        Try RoutesPlan free
      </LandingCTA>
    </div>
  );
}
