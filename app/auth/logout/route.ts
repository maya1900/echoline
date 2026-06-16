import { NextResponse } from "next/server";

const authCookieNames = [
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
  "next-auth.callback-url",
  "__Secure-next-auth.callback-url",
  "next-auth.csrf-token",
  "__Host-next-auth.csrf-token"
];

function clearAuthCookies() {
  const response = new NextResponse(null, {
    status: 303,
    headers: {
      Location: "/login"
    }
  });

  for (const name of authCookieNames) {
    response.cookies.set(name, "", { maxAge: 0, path: "/" });
  }

  return response;
}

export async function GET() {
  return clearAuthCookies();
}

export async function POST() {
  return clearAuthCookies();
}
