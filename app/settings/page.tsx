import { AppShell, SectionHeader } from "@/components/app-shell";
import { SettingsWorkbench } from "@/components/workbenches/settings-workbench";
import { requireCurrentUser } from "@/lib/auth/require-user";

export default async function SettingsPage() {
  await requireCurrentUser("/settings");

  return (
    <AppShell active="/settings">
      <SectionHeader eyebrow="设置" title="字幕、播放和评分" />
      <SettingsWorkbench />
    </AppShell>
  );
}
