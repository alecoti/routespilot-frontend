import { AppSidebar } from "@/components/app-shell/app-sidebar";
import { MobileNavigation } from "@/components/app-shell/mobile-navigation";
import { type NavKey } from "@/lib/navigation";
import { cn } from "@/lib/utils";

export function AppShell({
  active,
  children,
  className,
}: {
  active?: NavKey;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <MobileNavigation />
      <AppSidebar active={active} />
      <main
        className={cn(
          "min-h-screen pt-16 md:pl-[var(--sidebar-width)] md:pt-0",
          className,
        )}
      >
        {children}
      </main>
    </div>
  );
}
