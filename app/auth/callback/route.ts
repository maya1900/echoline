import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const next = requestUrl.searchParams.get("next") ?? "/";
  const loginUrl = new URL("/login", request.url);

  loginUrl.searchParams.set("next", next);
  loginUrl.searchParams.set("error", "登录回调地址已迁移，请使用新的 Auth.js OAuth callback。");

  return NextResponse.redirect(loginUrl);
}
