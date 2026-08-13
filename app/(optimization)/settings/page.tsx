import { AppShell } from "@/components/app-shell/app-shell";
import { SettingsPageContent } from "@/components/settings/settings-page-content";

export default function SettingsPage() {
  return (
    <AppShell active="settings">
      <SettingsPageContent />
    </AppShell>
  );
}
