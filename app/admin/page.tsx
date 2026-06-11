import { AppShell, SectionHeader } from "@/components/app-shell";
import { AdminWorkbench } from "@/components/workbenches/admin-workbench";
import { getSiteSettings, listAdminUsers } from "@/lib/admin-data";
import { requireAdmin } from "@/lib/auth/require-user";
import { listAdminImportJobs, listSeries } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireAdmin("/admin");

  const [series, adminImportJobs, adminUsers, siteSettings] = await Promise.all([listSeries(), listAdminImportJobs(), listAdminUsers(), getSiteSettings()]);

  return (
    <AppShell active="/admin">
      <SectionHeader eyebrow="Admin" title="后台管理" />
      <AdminWorkbench initialSeries={series} initialJobs={adminImportJobs} initialUsers={adminUsers} initialSettings={siteSettings} />
    </AppShell>
  );
}
