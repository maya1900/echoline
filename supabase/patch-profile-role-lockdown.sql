-- Patch existing Supabase projects to prevent users from self-promoting by updating profiles.role.
-- Run this once in Supabase SQL Editor if the project was created before column-level profile grants were tightened.

revoke insert, update on public.profiles from authenticated;

grant insert (id, email, display_name, avatar_url) on public.profiles to authenticated;

grant update (
  email,
  display_name,
  avatar_url,
  subtitle_language,
  default_playback_rate,
  auto_loop,
  ai_scoring_enabled,
  asr_provider,
  asr_model,
  asr_api_key,
  updated_at
) on public.profiles to authenticated;
