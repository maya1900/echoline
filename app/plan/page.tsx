import { AppShell, SectionHeader } from "@/components/app-shell";
import { PlanWorkbench } from "@/components/workbenches/plan-workbench";
import { getStudyPlan } from "@/lib/data";

export default async function PlanPage() {
  const studyPlan = await getStudyPlan();

  return (
    <AppShell active="/plan">
      <SectionHeader eyebrow="学习计划" title="调整每日节奏" />
      <PlanWorkbench plan={studyPlan} />
    </AppShell>
  );
}
