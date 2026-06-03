import { AppShell, SectionHeader } from "@/components/app-shell";
import { AdminWorkbench } from "@/components/workbenches/admin-workbench";
import { listAdminImportJobs, listSeries } from "@/lib/data";

export default async function AdminPage() {
  const series = await listSeries();
  const adminImportJobs = await listAdminImportJobs();

  return (
    <AppShell active="/admin">
      <SectionHeader eyebrow="个人导入" title="内容维护" />
      <AdminWorkbench initialSeries={series} initialJobs={adminImportJobs} />
    </AppShell>
  );
}
