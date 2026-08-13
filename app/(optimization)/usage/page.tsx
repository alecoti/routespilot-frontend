import { AppShell } from "@/components/app-shell/app-shell";
import { UsagePageContent } from "@/components/usage/usage-page-content";

export default function UsagePage() {
  return (
    <AppShell active="usage">
      <UsagePageContent />
    </AppShell>
  );
}
