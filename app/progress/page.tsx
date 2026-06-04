import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { AppShell, Metric, SectionHeader } from "@/components/app-shell";
import { requireCurrentUser } from "@/lib/auth/require-user";
import { getProgressData, getSubtitlesForEpisode, listSeries } from "@/lib/data";

export default async function ProgressPage() {
  await requireCurrentUser("/progress");

  const series = await listSeries();
  const { rows: progressRows, summary: progressSummary } = await getProgressData();
  const currentEpisode = series[0].episodes[0];
  const recentLines = (await getSubtitlesForEpisode(currentEpisode.id)).slice(0, 4);

  return (
    <AppShell active="/progress">
      <SectionHeader eyebrow="学习进度" title="本周表现" />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="连续学习" value={`${progressSummary.streakDays} 天`} tone="green" />
        <Metric label="本周练习句子" value={`${progressSummary.weeklyLines}`} tone="amber" />
        <Metric label="平均内容正确率" value={`${progressSummary.averageAccuracy}%`} />
        <Metric label="累计学习" value={`${progressSummary.totalMinutes} 分钟`} />
      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="rounded-md border border-[color:var(--line)] bg-[color:var(--panel)] p-5">
          <h2 className="text-xl font-bold">目标推进</h2>
          <div className="mt-5 grid gap-4">
            {progressRows.map((row) => (
              <div key={row.id} className="rounded-md border border-[color:var(--line)] p-4">
                <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                  <span className="font-semibold">{row.label}</span>
                  <span>
                    {row.value}/{row.target}
                  </span>
                </div>
                <div className="h-3 rounded-full bg-black/10">
                  <div className="h-3 rounded-full bg-[color:var(--green)]" style={{ width: `${Math.min((row.value / row.target) * 100, 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <aside className="rounded-md border border-[color:var(--line)] bg-[color:var(--panel)] p-5">
          <h2 className="text-xl font-bold">刚练过的句子</h2>
          <div className="mt-4 space-y-3">
            {recentLines.map((line) => (
              <div key={line.id} className="rounded-md border border-[color:var(--line)] p-3">
                <div className="mb-2 flex items-center gap-2 text-xs text-[color:var(--muted)]">
                  <CheckCircle2 className="h-4 w-4 text-[color:var(--green)]" aria-hidden="true" />
                  第 {line.lineIndex} 句
                </div>
                <p className="sentence-font text-base leading-7">{line.englishText}</p>
                <p className="mt-1 text-sm text-[color:var(--muted)]">{line.chineseText}</p>
              </div>
            ))}
          </div>
          <Link href={`/learn/${currentEpisode.id}`} className="ink-action mt-4 flex h-11 items-center justify-center gap-2 rounded-md text-sm font-semibold">
            继续精听
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </aside>
      </section>
    </AppShell>
  );
}
