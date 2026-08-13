import { AppShell } from "@/components/app-shell/app-shell";
import { HistoryPageContent } from "@/components/history/history-page-content";

export default function HistoryPage() {
  return (
    <AppShell active="history">
      <HistoryPageContent />
    </AppShell>
  );
}
