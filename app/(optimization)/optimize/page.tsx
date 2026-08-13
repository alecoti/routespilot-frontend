import { AppShell } from "@/components/app-shell/app-shell";
import { OptimizeChat } from "@/components/chat/optimize-chat";
import { OptimizeHeader } from "@/components/chat/optimize-header";
import { ProblemSetupPanel } from "@/components/problem-setup/problem-setup-panel";
import { OptimizationInitializer } from "@/components/settings/optimization-initializer";

export default function OptimizePage() {
  return (
    <AppShell className="md:h-screen md:overflow-hidden">
      <OptimizationInitializer />
      <div className="flex min-h-[calc(100vh-4rem)] flex-col bg-card md:h-screen lg:flex-row">
        <section className="relative flex min-h-[720px] flex-1 flex-col border-r border-border bg-card lg:min-w-0">
          <OptimizeHeader />
          <OptimizeChat />
        </section>

        <ProblemSetupPanel />
      </div>
    </AppShell>
  );
}
