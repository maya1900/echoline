import { NextResponse } from "next/server";
import { bootstrapUserProfile } from "@/lib/auth/bootstrap";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return NextResponse.json({ data: { bootstrapped: false, reason: "supabase_not_configured" } });
  }

  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await bootstrapUserProfile(user);
  return NextResponse.json({ data: { bootstrapped: true } });
}
