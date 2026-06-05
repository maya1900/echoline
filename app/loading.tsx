import { BookOpen, CalendarClock, ChartNoAxesCombined, Clapperboard, Library, Settings } from "lucide-react";

const navItems = [
  { label: "工作台", icon: Clapperboard },
  { label: "剧集", icon: Library },
  { label: "进度", icon: ChartNoAxesCombined },
  { label: "生词", icon: BookOpen },
  { label: "计划", icon: CalendarClock },
  { label: "设置", icon: Settings }
];

function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`loading-skeleton rounded-md ${className}`} />;
}

export default function Loading() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 border-b border-[color:var(--line)] bg-[rgba(247,242,232,0.92)] backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="ink-action grid h-10 w-10 shrink-0 place-items-center rounded-md">
              <Clapperboard className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold">Your English Coach</span>
              <span className="block truncate text-xs text-[color:var(--muted)]">看剧学英语工作台</span>
            </span>
          </div>
          <nav className="hidden items-center gap-1 lg:flex">
            {navItems.map((item) => (
              <span key={item.label} className="flex h-10 items-center gap-2 rounded-md px-3 text-sm text-[color:var(--muted)]">
                <item.icon className="h-4 w-4" aria-hidden="true" />
                {item.label}
              </span>
            ))}
          </nav>
          <SkeletonBlock className="h-10 w-10 border border-[color:var(--ink)]" />
        </div>
        <nav className="flex gap-1 overflow-x-auto border-t border-[color:var(--line)] px-3 py-2 lg:hidden">
          {navItems.map((item) => (
            <span key={item.label} className="flex h-10 shrink-0 items-center gap-2 rounded-md px-3 text-sm text-[color:var(--muted)]">
              <item.icon className="h-4 w-4" aria-hidden="true" />
              {item.label}
            </span>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-8">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="mb-1 text-xs font-semibold uppercase text-[color:var(--amber)]">正在载入</p>
            <h1 className="truncate text-2xl font-bold sm:text-3xl">准备页面</h1>
          </div>
        </div>

        <section className="grid gap-4 lg:grid-cols-[1.45fr_0.95fr]">
          <div className="overflow-hidden rounded-md border border-[color:var(--ink)] bg-[color:var(--panel)]">
            <div className="grid min-h-[360px] md:grid-cols-[0.9fr_1.1fr]">
              <SkeletonBlock className="min-h-64 rounded-none bg-[color:var(--ink)]/15" />
              <div className="flex flex-col justify-between p-5 sm:p-7">
                <div>
                  <div className="flex gap-2">
                    <SkeletonBlock className="h-6 w-14" />
                    <SkeletonBlock className="h-6 w-24" />
                    <SkeletonBlock className="h-6 w-20" />
                  </div>
                  <SkeletonBlock className="mt-6 h-9 w-3/4" />
                  <SkeletonBlock className="mt-3 h-4 w-full" />
                  <SkeletonBlock className="mt-2 h-4 w-5/6" />
                </div>
                <div className="mt-8">
                  <div className="mb-3 flex items-center justify-between gap-4">
                    <SkeletonBlock className="h-4 w-20" />
                    <SkeletonBlock className="h-4 w-10" />
                  </div>
                  <SkeletonBlock className="h-3 w-full rounded-full" />
                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <SkeletonBlock className="h-12" />
                    <SkeletonBlock className="h-12" />
                    <SkeletonBlock className="h-12" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <aside className="grid gap-4">
            <div className="rounded-md border border-[color:var(--line)] bg-[color:var(--panel)] p-5">
              <div className="mb-4 flex items-center justify-between">
                <SkeletonBlock className="h-5 w-20" />
                <SkeletonBlock className="h-5 w-5" />
              </div>
              <div className="grid gap-4">
                <SkeletonBlock className="h-10" />
                <SkeletonBlock className="h-10" />
                <SkeletonBlock className="h-10" />
              </div>
            </div>

            <div className="rounded-md border border-[color:var(--line)] bg-[color:var(--panel)] p-5">
              <SkeletonBlock className="h-5 w-24" />
              <div className="mt-4 space-y-3">
                <SkeletonBlock className="h-20" />
                <SkeletonBlock className="h-20" />
                <SkeletonBlock className="h-20" />
              </div>
            </div>
          </aside>
        </section>

        <section className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SkeletonBlock className="h-24" />
          <SkeletonBlock className="h-24" />
          <SkeletonBlock className="h-24" />
          <SkeletonBlock className="h-24" />
        </section>
      </main>
    </div>
  );
}
