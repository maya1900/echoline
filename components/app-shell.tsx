import Link from "next/link";
import { BookOpen, CalendarClock, ChartNoAxesCombined, Clapperboard, Library, LogOut, Settings, ShieldCheck } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/bootstrap";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "工作台", icon: Clapperboard },
  { href: "/series", label: "剧集", icon: Library },
  { href: "/progress", label: "进度", icon: ChartNoAxesCombined },
  { href: "/vocab", label: "生词", icon: BookOpen },
  { href: "/plan", label: "计划", icon: CalendarClock },
  { href: "/settings", label: "设置", icon: Settings },
  { href: "/admin", label: "导入", icon: ShieldCheck }
];

export async function AppShell({
  children,
  active
}: {
  children: React.ReactNode;
  active: string;
}) {
  const user = await getCurrentUser();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-[color:var(--line)] bg-[rgba(247,242,232,0.92)] backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-[color:var(--ink)] text-white">
              <Clapperboard className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold">Your English Coach</span>
              <span className="block truncate text-xs text-[color:var(--muted)]">看剧学英语工作台</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-1 lg:flex">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex h-10 items-center gap-2 rounded-md px-3 text-sm text-[color:var(--muted)] transition hover:bg-black/5 hover:text-[color:var(--ink)]",
                  active === item.href && "bg-[color:var(--ink)] text-white hover:bg-[color:var(--ink)] hover:text-white"
                )}
              >
                <item.icon className="h-4 w-4" aria-hidden="true" />
                {item.label}
              </Link>
            ))}
          </nav>
          {user ? (
            <form action="/auth/logout" method="post" className="flex min-w-0 items-center gap-2">
              <span className="hidden max-w-48 truncate text-sm text-[color:var(--muted)] sm:block">{user.email}</span>
              <button className="grid h-10 w-10 place-items-center rounded-md border border-[color:var(--ink)] transition hover:bg-[color:var(--ink)] hover:text-white" aria-label="退出登录">
                <LogOut className="h-4 w-4" aria-hidden="true" />
              </button>
            </form>
          ) : (
            <Link
              href="/login"
              className="h-10 rounded-md border border-[color:var(--ink)] px-4 py-2 text-sm font-semibold transition hover:bg-[color:var(--ink)] hover:text-white"
            >
              登录
            </Link>
          )}
        </div>
        <nav className="flex gap-1 overflow-x-auto border-t border-[color:var(--line)] px-3 py-2 lg:hidden">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex h-10 shrink-0 items-center gap-2 rounded-md px-3 text-sm text-[color:var(--muted)]",
                active === item.href && "bg-[color:var(--ink)] text-white"
              )}
            >
              <item.icon className="h-4 w-4" aria-hidden="true" />
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}

export function SectionHeader({
  title,
  eyebrow,
  action
}: {
  title: string;
  eyebrow?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div className="min-w-0">
        {eyebrow ? <p className="mb-1 text-xs font-semibold uppercase text-[color:var(--amber)]">{eyebrow}</p> : null}
        <h1 className="truncate text-2xl font-bold sm:text-3xl">{title}</h1>
      </div>
      {action}
    </div>
  );
}

export function Metric({
  label,
  value,
  tone = "ink"
}: {
  label: string;
  value: string;
  tone?: "ink" | "green" | "amber" | "red";
}) {
  const color = {
    ink: "text-[color:var(--ink)]",
    green: "text-[color:var(--green)]",
    amber: "text-[color:var(--amber)]",
    red: "text-[color:var(--red)]"
  }[tone];

  return (
    <div className="rounded-md border border-[color:var(--line)] bg-[color:var(--panel)] p-4">
      <div className={cn("sentence-font text-3xl font-bold", color)}>{value}</div>
      <div className="mt-1 text-sm text-[color:var(--muted)]">{label}</div>
    </div>
  );
}
