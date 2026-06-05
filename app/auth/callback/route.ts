import { NextResponse } from "next/server";
import { bootstrapUserProfile } from "@/lib/auth/bootstrap";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") ?? "/";
  const authError = requestUrl.searchParams.get("error_description") ?? requestUrl.searchParams.get("error");

  if (authError) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", next);
    loginUrl.searchParams.set("error", authError);

    return NextResponse.redirect(loginUrl);
  }

  if (code) {
    const supabase = await createSupabaseServerClient();

    if (supabase) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (!error && data.user) {
        await bootstrapUserProfile(data.user);
      } else if (error) {
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set("next", next);
        loginUrl.searchParams.set("error", error.message);

        return NextResponse.redirect(loginUrl);
      }
    }
  }

  return NextResponse.redirect(new URL(next, request.url));
}
