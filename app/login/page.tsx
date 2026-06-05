import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";
import { getSiteSettings } from "@/lib/admin-data";

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  const nextPath = next?.startsWith("/") && !next.startsWith("//") ? next : "/";
  const siteSettings = await getSiteSettings();

  return (
    <main className="grid min-h-screen place-items-center px-4 py-8">
      <section className="w-full max-w-md rounded-md border border-[color:var(--ink)] bg-[color:var(--panel)] p-5 shadow-[8px_8px_0_rgba(23,20,17,0.12)]">
        <Link href="/" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--muted)]">
          <ArrowRight className="h-4 w-4 rotate-180" aria-hidden="true" />
          返回工作台
        </Link>
        <h1 className="text-2xl font-bold">登录追句 EchoLine</h1>
        {error ? <p className="mt-4 rounded-md border border-[color:var(--red)] bg-white/70 p-3 text-sm leading-6 text-[color:var(--red)]">{error}</p> : null}
        <LoginForm nextPath={nextPath} allowSignup={siteSettings.allowPublicSignup} />
      </section>
    </main>
  );
}
