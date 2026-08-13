import { AppShell } from "@/components/app-shell/app-shell";
import { AdminMetricsPageContent } from "@/components/admin/admin-metrics-page-content";

export default function AdminMetricsPage() {
  return (
    <AppShell active="adminMetrics">
      <AdminMetricsPageContent />
    </AppShell>
  );
}
