-- Patch existing Supabase projects created before ASR settings were added.
-- Run this once in Supabase SQL Editor if /settings fails with missing profile columns.

alter table public.profiles
  add column if not exists subtitle_language text not null default 'both',
  add column if not exists default_playback_rate numeric(3,2) not null default 1.00,
  add column if not exists auto_loop boolean not null default true,
  add column if not exists ai_scoring_enabled boolean not null default true,
  add column if not exists asr_provider text not null default 'openai',
  add column if not exists asr_model text not null default 'gpt-4o-mini-transcribe',
  add column if not exists asr_api_key text;

update public.profiles
set
  subtitle_language = coalesce(subtitle_language, 'both'),
  default_playback_rate = coalesce(default_playback_rate, 1.00),
  auto_loop = coalesce(auto_loop, true),
  ai_scoring_enabled = coalesce(ai_scoring_enabled, true),
  asr_provider = coalesce(asr_provider, 'openai'),
  asr_model = coalesce(asr_model, 'gpt-4o-mini-transcribe');
