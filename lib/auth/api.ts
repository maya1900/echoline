import type { User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;
type RequestAuthResult =
  | { error: NextResponse; supabase: null; user: null }
  | { error: null; supabase: SupabaseServerClient; user: User };

export async function requireUserRequest(): Promise<RequestAuthResult> {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return { error: NextResponse.json({ error: "Supabase is not configured" }, { status: 503 }), supabase: null, user: null };
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }), supabase: null, user: null };
  }

  return { error: null, supabase, user };
}

export async function requireAdminRequest(): Promise<RequestAuthResult> {
  const auth = await requireUserRequest();

  if (auth.error) {
    return auth;
  }

  const { supabase, user } = auth;
  const { data: profile, error } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();

  if (error || profile?.role !== "admin") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }), supabase: null, user: null };
  }

  return { error: null, supabase, user };
}
