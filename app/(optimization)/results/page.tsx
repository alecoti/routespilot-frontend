import { AppShell } from "@/components/app-shell/app-shell";
import { ResultsPageContent } from "@/components/results/results-page-content";

export default function ResultsPage() {
  return (
    <AppShell active="history">
      <ResultsPageContent />
    </AppShell>
  );
}
