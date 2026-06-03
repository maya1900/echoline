"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, Mail } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

type Mode = "login" | "signup";

export function LoginForm() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState(supabase ? "" : "当前未配置 Supabase 环境变量，登录表单处于 mock 模式。");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase) {
      setMessage("填好 .env.local 后即可启用 Supabase Auth。");
      return;
    }

    setIsSubmitting(true);
    setMessage("");

    const authRequest =
      mode === "login"
        ? supabase.auth.signInWithPassword({ email, password })
        : supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: `${window.location.origin}/auth/callback`
            }
          });

    const { data, error } = await authRequest;
    setIsSubmitting(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    if (mode === "signup" && !data.session) {
      setMessage("注册邮件已发送，请完成邮箱确认后再回来登录。");
      return;
    }

    if (data.user) {
      await fetch("/api/auth/bootstrap", { method: "POST" });
    }

    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 grid gap-3">
      <div className="grid grid-cols-2 gap-2 rounded-md border border-[color:var(--line)] bg-white/50 p-1">
        {(["login", "signup"] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setMode(item)}
            className={cn("h-9 rounded text-sm font-semibold text-[color:var(--muted)]", mode === item && "bg-[color:var(--ink)] text-[color:var(--paper)]")}
          >
            {item === "login" ? "登录" : "注册"}
          </button>
        ))}
      </div>
      <label className="grid gap-2 text-sm font-semibold">
        邮箱
        <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required placeholder="you@example.com" className="h-11 rounded-md border border-[color:var(--line)] bg-white/70 px-3 outline-none focus:border-[color:var(--ink)]" />
      </label>
      <label className="grid gap-2 text-sm font-semibold">
        密码
        <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" required minLength={8} placeholder="至少 8 位" className="h-11 rounded-md border border-[color:var(--line)] bg-white/70 px-3 outline-none focus:border-[color:var(--ink)]" />
      </label>
      <button disabled={isSubmitting} className="mt-2 flex h-11 items-center justify-center gap-2 rounded-md bg-[color:var(--ink)] text-sm font-semibold text-[color:var(--paper)] disabled:cursor-not-allowed disabled:opacity-60">
        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Mail className="h-4 w-4" aria-hidden="true" />}
        {mode === "login" ? "登录" : "创建账号"}
      </button>
      <button type="button" disabled className="flex h-11 items-center justify-center gap-2 rounded-md border border-[color:var(--line)] text-sm font-semibold text-[color:var(--muted)]">
        <KeyRound className="h-4 w-4" aria-hidden="true" />
        OAuth 预留
      </button>
      {message ? <p className="rounded-md border border-[color:var(--line)] bg-white/60 p-3 text-sm leading-6 text-[color:var(--muted)]">{message}</p> : null}
    </form>
  );
}
