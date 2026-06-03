import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center px-4 py-8">
      <section className="w-full max-w-md rounded-md border border-[color:var(--ink)] bg-[color:var(--panel)] p-5 shadow-[8px_8px_0_rgba(23,20,17,0.12)]">
        <Link href="/" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--muted)]">
          <ArrowRight className="h-4 w-4 rotate-180" aria-hidden="true" />
          返回工作台
        </Link>
        <h1 className="text-2xl font-bold">登录 Your English Coach</h1>
        <LoginForm />
      </section>
    </main>
  );
}
