import Link from "next/link";
import { headers } from "next/headers";
import { ArrowRight } from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";
import { getSiteSettings } from "@/lib/admin-data";

const authErrorMessages: Record<string, string> = {
  OAuthSignin: "无法跳转到 Linux.do，请检查 OAuth 配置。",
  OAuthAccountNotLinked: "该邮箱已绑定其他登录方式，请使用原方式登录。",
  OAuthCreateAccount: "创建 OAuth 账号失败，请稍后重试。",
  Callback: "登录回调处理失败，请稍后重试。",
  CredentialsSignin: "邮箱或密码不正确。",
  AccessDenied: "登录请求被拒绝。"
};

function formatAuthError(error?: string, authOrigin?: string) {
  if (!error) {
    return "";
  }

  if (error === "OAuthCallback") {
    const originHint = authOrigin ? `请从 ${authOrigin} 打开本站` : "请从 OAuth 配置里的站点地址打开本站";

    return `Linux.do 已回调到本站，但登录校验失败。${originHint}，并确认启动服务的终端可以访问 connect.linux.do。`;
  }

  return authErrorMessages[error] ?? error;
}

function getRequestOrigin(requestHeaders: Headers) {
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");

  if (!host) {
    return "";
  }

  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");

  return `${protocol}://${host}`;
}

function getAuthOrigin() {
  const authUrl = process.env.NEXTAUTH_URL;

  if (!authUrl) {
    return "";
  }

  try {
    return new URL(authUrl).origin;
  } catch {
    return "";
  }
}

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  const requestHeaders = await headers();
  const nextPath = next?.startsWith("/") && !next.startsWith("//") ? next : "/";
  const siteSettings = await getSiteSettings();
  const requestOrigin = getRequestOrigin(requestHeaders);
  const authOrigin = getAuthOrigin();
  const errorMessage = formatAuthError(error, authOrigin);
  const hasAuthOriginMismatch = Boolean(requestOrigin && authOrigin && requestOrigin !== authOrigin);
  const expectedLoginUrl = authOrigin ? `${authOrigin}/login${nextPath === "/" ? "" : `?next=${encodeURIComponent(nextPath)}`}` : "";

  return (
    <main className="grid min-h-screen place-items-center px-4 py-8">
      <section className="w-full max-w-md rounded-md border border-[color:var(--ink)] bg-[color:var(--panel)] p-5 shadow-[8px_8px_0_rgba(23,20,17,0.12)]">
        <Link href="/" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--muted)]">
          <ArrowRight className="h-4 w-4 rotate-180" aria-hidden="true" />
          返回工作台
        </Link>
        <h1 className="text-2xl font-bold">登录追句 EchoLine</h1>
        {errorMessage ? <p className="mt-4 rounded-md border border-[color:var(--red)] bg-white/70 p-3 text-sm leading-6 text-[color:var(--red)]">{errorMessage}</p> : null}
        {hasAuthOriginMismatch ? (
          <p className="mt-3 rounded-md border border-[color:var(--amber)]/45 bg-white/70 p-3 text-sm leading-6 text-[color:var(--amber)]">
            当前访问地址是 {requestOrigin}，OAuth 配置地址是 {authOrigin}。请用{" "}
            {expectedLoginUrl ? (
              <a href={expectedLoginUrl} className="font-semibold underline">
                {authOrigin}
              </a>
            ) : (
              authOrigin
            )}{" "}
            打开本站后再登录。
          </p>
        ) : null}
        <LoginForm
          nextPath={nextPath}
          allowSignup={siteSettings.allowPublicSignup}
          linuxDoDisabledReason={hasAuthOriginMismatch ? `请先用 ${authOrigin} 打开本站再使用 Linux.do 登录。` : undefined}
        />
      </section>
    </main>
  );
}
