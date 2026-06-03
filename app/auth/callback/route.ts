import { NextResponse } from "next/server";
import { bootstrapUserProfile } from "@/lib/auth/bootstrap";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createSupabaseServerClient();

    if (supabase) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (!error && data.user) {
        await bootstrapUserProfile(data.user);
      }
    }
  }

  return NextResponse.redirect(new URL(next, request.url));
}
