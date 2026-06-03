import Link from "next/link";
import { ArrowRight, BookOpen, CheckCircle2, Clock3, Headphones, Play, Repeat2 } from "lucide-react";
import { AppShell, Metric, SectionHeader } from "@/components/app-shell";
import { getStudyPlan, getSubtitlesForEpisode, listSeries } from "@/lib/data";
import { formatTime } from "@/lib/utils";

export default async function DashboardPage() {
  const series = await listSeries();
  const studyPlan = await getStudyPlan();
  const currentSeries = series[0];
  const currentEpisode = currentSeries.episodes[0];
  const lines = await getSubtitlesForEpisode(currentEpisode.id);

  return (
    <AppShell active="/">
      <SectionHeader
        eyebrow="今日学习"
        title="从上次停下的句子继续"
        action={
          <Link
            href={`/learn/${currentEpisode.id}`}
            className="hidden h-11 items-center gap-2 rounded-md bg-[color:var(--ink)] px-4 text-sm font-semibold text-white sm:flex"
          >
            <Play className="h-4 w-4" aria-hidden="true" />
            继续
          </Link>
        }
      />

      <section className="grid gap-4 lg:grid-cols-[1.45fr_0.95fr]">
        <div className="overflow-hidden rounded-md border border-[color:var(--ink)] bg-[color:var(--panel)]">
          <div className="grid min-h-[360px] md:grid-cols-[0.9fr_1.1fr]">
            <div className="relative min-h-64 bg-[color:var(--ink)]">
              <img src={currentSeries.coverUrl} alt={`${currentSeries.title} 封面`} className="h-full w-full object-cover opacity-90" />
              <div className="absolute bottom-4 left-4 rounded-md bg-[rgba(23,20,17,0.86)] px-3 py-2 text-white">
                <p className="text-xs text-white/70">S{currentEpisode.seasonNumber}E{currentEpisode.episodeNumber}</p>
                <p className="font-semibold">{currentEpisode.title}</p>
              </div>
            </div>
            <div className="flex flex-col justify-between p-5 sm:p-7">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                  <span className="rounded bg-[color:var(--green)] px-2 py-1 text-white">{currentSeries.difficulty}</span>
                  <span className="rounded border border-[color:var(--line)] px-2 py-1 text-[color:var(--muted)]">{currentSeries.genre}</span>
                  <span className="rounded border border-[color:var(--line)] px-2 py-1 text-[color:var(--muted)]">{formatTime(currentEpisode.durationSeconds)}</span>
                </div>
                <h2 className="mt-5 text-3xl font-bold">{currentSeries.title}</h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-[color:var(--muted)]">{currentEpisode.description}</p>
              </div>
              <div className="mt-8">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-semibold">本集进度</span>
                  <span>{currentEpisode.progress}%</span>
                </div>
                <div className="h-3 rounded-full bg-black/10">
                  <div className="h-3 rounded-full bg-[color:var(--amber)]" style={{ width: `${currentEpisode.progress}%` }} />
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <Link href={`/learn/${currentEpisode.id}`} className="flex h-12 items-center justify-center gap-2 rounded-md bg-[color:var(--ink)] px-3 text-sm font-semibold text-white">
                    <Play className="h-4 w-4" aria-hidden="true" />
                    继续学习
                  </Link>
                  <Link href={`/learn/${currentEpisode.id}`} className="flex h-12 items-center justify-center gap-2 rounded-md border border-[color:var(--line)] px-3 text-sm font-semibold">
                    <Headphones className="h-4 w-4" aria-hidden="true" />
                    精听
                  </Link>
                  <Link href="/vocab" className="flex h-12 items-center justify-center gap-2 rounded-md border border-[color:var(--line)] px-3 text-sm font-semibold">
                    <BookOpen className="h-4 w-4" aria-hidden="true" />
                    复习词
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        <aside className="grid gap-4">
          <div className="rounded-md border border-[color:var(--line)] bg-[color:var(--panel)] p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-bold">今日计划</h2>
              <Clock3 className="h-5 w-5 text-[color:var(--amber)]" aria-hidden="true" />
            </div>
            {[
              ["分钟", studyPlan.completedMinutes, studyPlan.dailyMinutes],
              ["句子", studyPlan.completedLines, studyPlan.dailyLines],
              ["跟读", studyPlan.completedRepeats, studyPlan.dailyRepeats]
            ].map(([label, done, total]) => (
              <div key={label} className="mb-4 last:mb-0">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span>{label}</span>
                  <span className="font-semibold">{done}/{total}</span>
                </div>
                <div className="h-2 rounded-full bg-black/10">
                  <div className="h-2 rounded-full bg-[color:var(--green)]" style={{ width: `${(Number(done) / Number(total)) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-md border border-[color:var(--line)] bg-[color:var(--panel)] p-5">
            <h2 className="mb-3 font-bold">下一组句子</h2>
            <div className="space-y-3">
              {lines.slice(0, 3).map((line) => (
                <div key={line.id} className="rounded-md border border-[color:var(--line)] p-3">
                  <p className="sentence-font text-base">{line.englishText}</p>
                  <p className="mt-1 text-sm text-[color:var(--muted)]">{line.chineseText}</p>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </section>

      <section className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="连续学习" value="9 天" tone="green" />
        <Metric label="本周练习句子" value="73" tone="amber" />
        <Metric label="平均内容正确率" value="86%" />
        <Metric label="今日到期生词" value="12" tone="red" />
      </section>

      <section className="mt-8">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold">最近剧集</h2>
          <Link href="/series" className="flex h-10 items-center gap-2 rounded-md border border-[color:var(--line)] px-3 text-sm font-semibold">
            全部
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {series.map((item) => (
            <Link key={item.id} href={`/learn/${item.episodes[0].id}`} className="group grid gap-4 rounded-md border border-[color:var(--line)] bg-[color:var(--panel)] p-4 sm:grid-cols-[128px_1fr]">
              <img src={item.coverUrl} alt={`${item.title} 封面`} className="h-32 w-full rounded object-cover sm:w-32" />
              <div className="min-w-0">
                <div className="mb-2 flex items-center gap-2 text-xs text-[color:var(--muted)]">
                  <CheckCircle2 className="h-4 w-4 text-[color:var(--green)]" aria-hidden="true" />
                  {item.progress}% 完成
                </div>
                <h3 className="truncate text-lg font-bold group-hover:underline">{item.title}</h3>
                <p className="mt-1 line-clamp-2 text-sm leading-6 text-[color:var(--muted)]">{item.description}</p>
                <div className="mt-3 flex items-center gap-2 text-sm font-semibold text-[color:var(--amber)]">
                  <Repeat2 className="h-4 w-4" aria-hidden="true" />
                  {item.episodes.length} 集可学习
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
