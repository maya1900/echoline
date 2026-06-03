import Link from "next/link";
import { ArrowRight, KeyRound, Mail } from "lucide-react";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center px-4 py-8">
      <section className="w-full max-w-md rounded-md border border-[color:var(--ink)] bg-[color:var(--panel)] p-5 shadow-[8px_8px_0_rgba(23,20,17,0.12)]">
        <Link href="/" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--muted)]">
          <ArrowRight className="h-4 w-4 rotate-180" aria-hidden="true" />
          返回工作台
        </Link>
        <h1 className="text-2xl font-bold">登录 Your English Coach</h1>
        <form className="mt-6 grid gap-3">
          <label className="grid gap-2 text-sm font-semibold">
            邮箱
            <input type="email" placeholder="you@example.com" className="h-11 rounded-md border border-[color:var(--line)] bg-white/70 px-3 outline-none focus:border-[color:var(--ink)]" />
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            密码
            <input type="password" placeholder="至少 8 位" className="h-11 rounded-md border border-[color:var(--line)] bg-white/70 px-3 outline-none focus:border-[color:var(--ink)]" />
          </label>
          <button className="mt-2 flex h-11 items-center justify-center gap-2 rounded-md bg-[color:var(--ink)] text-sm font-semibold text-[color:var(--paper)]">
            <Mail className="h-4 w-4" aria-hidden="true" />
            登录 / 注册
          </button>
          <button type="button" className="flex h-11 items-center justify-center gap-2 rounded-md border border-[color:var(--line)] text-sm font-semibold">
            <KeyRound className="h-4 w-4" aria-hidden="true" />
            OAuth 预留
          </button>
        </form>
      </section>
    </main>
  );
}
