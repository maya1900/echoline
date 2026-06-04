import type { User } from "@supabase/supabase-js";
import { getSiteSettings } from "@/lib/admin-data";
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

  const siteSettings = await getSiteSettings();

  await supabase.from("study_plans").upsert({
    user_id: user.id,
    daily_minutes: siteSettings.defaultDailyMinutes,
    daily_lines: siteSettings.defaultDailyLines,
    daily_repeats: siteSettings.defaultDailyRepeats,
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

export async function getCurrentProfile() {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return null;
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data, error } = await supabase.from("profiles").select("id,email,display_name,role").eq("id", user.id).maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as {
    id: string;
    email: string | null;
    display_name: string | null;
    role: "user" | "admin";
  };
}

export async function isCurrentUserAdmin() {
  const profile = await getCurrentProfile();
  return profile?.role === "admin";
}
