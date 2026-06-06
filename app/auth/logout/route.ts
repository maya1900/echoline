import { NextResponse } from "next/server";

const authCookieNames = [
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
  "next-auth.callback-url",
  "__Secure-next-auth.callback-url",
  "next-auth.csrf-token",
  "__Host-next-auth.csrf-token"
];

export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/login", request.url), { status: 303 });

  for (const name of authCookieNames) {
    response.cookies.set(name, "", { maxAge: 0, path: "/" });
  }

  return response;
}
