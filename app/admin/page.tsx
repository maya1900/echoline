import { FileUp, Plus, ShieldCheck } from "lucide-react";
import { AppShell, SectionHeader } from "@/components/app-shell";
import { listAdminImportJobs, listSeries } from "@/lib/data";

const statusText = {
  queued: "排队中",
  processing: "处理中",
  completed: "已完成",
  failed: "失败"
};

export default async function AdminPage() {
  const series = await listSeries();
  const adminImportJobs = await listAdminImportJobs();

  return (
    <AppShell active="/admin">
      <SectionHeader eyebrow="个人导入" title="内容维护" />

      <section className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <aside className="rounded-md border border-[color:var(--line)] bg-[color:var(--panel)] p-5">
          <div className="mb-4 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-[color:var(--green)]" aria-hidden="true" />
            <h2 className="text-xl font-bold">导入入口</h2>
          </div>
          <div className="grid gap-3">
            <button className="flex h-11 items-center justify-center gap-2 rounded-md bg-[color:var(--ink)] px-4 text-sm font-semibold text-[color:var(--paper)]">
              <Plus className="h-4 w-4" aria-hidden="true" />
              新建剧集
            </button>
            <button className="flex h-11 items-center justify-center gap-2 rounded-md border border-[color:var(--line)] px-4 text-sm font-semibold">
              <FileUp className="h-4 w-4" aria-hidden="true" />
              上传字幕
            </button>
          </div>
        </aside>

        <div className="grid gap-4">
          <section className="rounded-md border border-[color:var(--line)] bg-[color:var(--panel)] p-5">
            <h2 className="text-xl font-bold">已导入内容</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {series.map((item) => (
                <article key={item.id} className="rounded-md border border-[color:var(--line)] p-4">
                  <h3 className="font-bold">{item.title}</h3>
                  <p className="mt-1 text-sm text-[color:var(--muted)]">{item.episodes.length} 集 · {item.difficulty}</p>
                  <div className="mt-3 h-2 rounded-full bg-black/10">
                    <div className="h-2 rounded-full bg-[color:var(--amber)]" style={{ width: `${item.progress}%` }} />
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="rounded-md border border-[color:var(--line)] bg-[color:var(--panel)] p-5">
            <h2 className="text-xl font-bold">导入任务</h2>
            <div className="mt-4 space-y-3">
              {adminImportJobs.map((job) => (
                <article key={job.id} className="rounded-md border border-[color:var(--line)] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="font-bold">{job.title}</h3>
                    <span className="rounded border border-[color:var(--line)] px-2 py-1 text-xs font-semibold text-[color:var(--muted)]">{statusText[job.status]}</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">{job.result}</p>
                  <p className="mt-2 text-xs text-[color:var(--muted)]">{job.createdAt}</p>
                </article>
              ))}
            </div>
          </section>
        </div>
      </section>
    </AppShell>
  );
}
