import { AppShell, SectionHeader } from "@/components/app-shell";
import { SettingsWorkbench } from "@/components/workbenches/settings-workbench";

export default function SettingsPage() {
  return (
    <AppShell active="/settings">
      <SectionHeader eyebrow="设置" title="字幕、播放和评分" />
      <SettingsWorkbench />
    </AppShell>
  );
}
