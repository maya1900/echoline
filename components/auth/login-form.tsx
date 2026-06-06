"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, Mail } from "lucide-react";
import { signIn } from "next-auth/react";
import { cn } from "@/lib/utils";

type Mode = "login" | "signup";

export function LoginForm({ nextPath = "/", allowSignup = true }: { nextPath?: string; allowSignup?: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const visibleModes: Mode[] = allowSignup ? ["login", "signup"] : ["login"];

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSubmitting(true);
    setMessage("");

    if (mode === "signup" && !allowSignup) {
      setIsSubmitting(false);
      setMessage("当前未开放注册，请联系管理员创建账号。");
      return;
    }

    if (mode === "signup") {
      const registerResponse = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const registerPayload = await registerResponse.json().catch(() => ({}));

      if (!registerResponse.ok) {
        setIsSubmitting(false);
        setMessage(typeof registerPayload.error === "string" ? registerPayload.error : "注册失败，请稍后再试。");
        return;
      }
    }

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl: nextPath
    });

    setIsSubmitting(false);

    if (result?.error) {
      setMessage("邮箱或密码不正确。");
      return;
    }

    router.push(result?.url ?? nextPath);
    router.refresh();
  }

  async function handleLinuxDoLogin() {
    setIsSubmitting(true);
    setMessage("");
    await signIn("linuxdo", { callbackUrl: nextPath });
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 grid gap-3">
      <div className={cn("grid gap-2 rounded-md border border-[color:var(--line)] bg-white/50 p-1", allowSignup ? "grid-cols-2" : "grid-cols-1")}>
        {visibleModes.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setMode(item)}
            className={cn("h-9 rounded text-sm font-semibold text-[color:var(--muted)]", mode === item && "ink-action")}
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
      <button disabled={isSubmitting} className="ink-action mt-2 flex h-11 items-center justify-center gap-2 rounded-md text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60">
        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Mail className="h-4 w-4" aria-hidden="true" />}
        {mode === "login" ? "登录" : "创建账号"}
      </button>
      <button
        type="button"
        onClick={() => void handleLinuxDoLogin()}
        disabled={isSubmitting}
        className="flex h-11 items-center justify-center gap-2 rounded-md border border-[color:var(--line)] bg-white/55 text-sm font-semibold transition hover:border-[color:var(--ink)] hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        <KeyRound className="h-4 w-4" aria-hidden="true" />
        使用 Linux.do 登录
      </button>
      {message ? <p className="rounded-md border border-[color:var(--line)] bg-white/60 p-3 text-sm leading-6 text-[color:var(--muted)]">{message}</p> : null}
    </form>
  );
}
