import type { User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function bootstrapUserProfile(user: User) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return;
  }

  await supabase.from("profiles").upsert({
    id: user.id,
    email: user.email,
    display_name: user.user_metadata?.display_name ?? user.email?.split("@")[0] ?? "Learner"
  });

  await supabase.from("study_plans").upsert({
    user_id: user.id,
    daily_minutes: 25,
    daily_lines: 18,
    daily_repeats: 8,
    active: true
  });
}

export async function getCurrentUser() {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return null;
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  return user;
}
