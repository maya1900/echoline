create type public.user_role as enum ('user', 'admin');
create type public.content_status as enum ('draft', 'published', 'archived');
create type public.learning_mode as enum ('rough', 'intensive', 'loop', 'repeat', 'call_response');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  role public.user_role not null default 'user',
  subtitle_language text not null default 'both',
  default_playback_rate numeric(3,2) not null default 1.00,
  auto_loop boolean not null default true,
  ai_scoring_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.series (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  original_title text,
  description text,
  cover_url text,
  difficulty text not null default 'B1',
  genre text,
  status public.content_status not null default 'draft',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.episodes (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null references public.series(id) on delete cascade,
  season_number int not null default 1,
  episode_number int not null,
  title text not null,
  description text,
  media_url text,
  duration_seconds int,
  status public.content_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(series_id, season_number, episode_number)
);

create table public.subtitle_lines (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid not null references public.episodes(id) on delete cascade,
  line_index int not null,
  start_ms int not null,
  end_ms int not null,
  english_text text not null,
  chinese_text text,
  difficulty text,
  keywords text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(episode_id, line_index),
  check(start_ms >= 0),
  check(end_ms > start_ms)
);

create table public.learning_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  series_id uuid references public.series(id) on delete cascade,
  episode_id uuid references public.episodes(id) on delete cascade,
  subtitle_line_id uuid references public.subtitle_lines(id) on delete cascade,
  mode public.learning_mode not null,
  playback_position_ms int not null default 0,
  completed boolean not null default false,
  repeat_count int not null default 0,
  best_score int,
  last_studied_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, episode_id, subtitle_line_id, mode)
);

create table public.study_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  daily_minutes int not null default 25,
  daily_lines int not null default 18,
  daily_repeats int not null default 8,
  reminder_enabled boolean not null default false,
  reminder_time time,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id)
);

create table public.repeat_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  episode_id uuid not null references public.episodes(id) on delete cascade,
  subtitle_line_id uuid not null references public.subtitle_lines(id) on delete cascade,
  mode public.learning_mode not null,
  target_text text not null,
  transcript text,
  audio_url text,
  accuracy int,
  completeness int,
  fluency int,
  overall int,
  feedback text,
  created_at timestamptz not null default now()
);

create table public.dictionary_entries (
  word text primary key,
  phonetic text,
  translation text,
  definition text,
  pos text,
  exchange text,
  frq int,
  created_at timestamptz not null default now()
);

create table public.vocab_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  word text not null,
  phonetic text,
  context_sentence text,
  translation text,
  note text,
  episode_id uuid references public.episodes(id) on delete set null,
  subtitle_line_id uuid references public.subtitle_lines(id) on delete set null,
  status text not null default 'new',
  review_count int not null default 0,
  ease numeric(4,2) not null default 2.50,
  interval_days int not null default 0,
  due_at timestamptz,
  last_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, word)
);

create table public.admin_import_jobs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.profiles(id),
  episode_id uuid references public.episodes(id) on delete cascade,
  source_filename text,
  status text not null default 'pending',
  parsed_lines int not null default 0,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.site_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.series enable row level security;
alter table public.episodes enable row level security;
alter table public.subtitle_lines enable row level security;
alter table public.dictionary_entries enable row level security;
alter table public.learning_progress enable row level security;
alter table public.study_plans enable row level security;
alter table public.repeat_attempts enable row level security;
alter table public.vocab_items enable row level security;
alter table public.admin_import_jobs enable row level security;
alter table public.site_settings enable row level security;

grant usage on schema public to anon, authenticated, service_role;

grant select on public.series to anon, authenticated;
grant select on public.episodes to anon, authenticated;
grant select on public.subtitle_lines to anon, authenticated;

grant select on public.dictionary_entries to anon, authenticated;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.learning_progress to authenticated;
grant select, insert, update, delete on public.study_plans to authenticated;
grant select, insert, update, delete on public.repeat_attempts to authenticated;
grant select, insert, update, delete on public.vocab_items to authenticated;

grant select, insert, update, delete on public.series to authenticated;
grant select, insert, update, delete on public.episodes to authenticated;
grant select, insert, update, delete on public.subtitle_lines to authenticated;
grant select, insert, update, delete on public.admin_import_jobs to authenticated;
grant select, insert, update, delete on public.site_settings to authenticated;

grant all privileges on public.profiles to service_role;
grant all privileges on public.series to service_role;
grant all privileges on public.episodes to service_role;
grant all privileges on public.subtitle_lines to service_role;
grant all privileges on public.dictionary_entries to service_role;
grant all privileges on public.learning_progress to service_role;
grant all privileges on public.study_plans to service_role;
grant all privileges on public.repeat_attempts to service_role;
grant all privileges on public.vocab_items to service_role;
grant all privileges on public.admin_import_jobs to service_role;
grant all privileges on public.site_settings to service_role;

create policy "profiles read own" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles insert own" on public.profiles
  for insert with check (auth.uid() = id);

create policy "profiles update own" on public.profiles
  for update using (auth.uid() = id);

create policy "published series readable" on public.series
  for select using (status = 'published');

create policy "published episodes readable" on public.episodes
  for select using (status = 'published');

create policy "published subtitle lines readable" on public.subtitle_lines
  for select using (
    exists (
      select 1 from public.episodes e
      where e.id = subtitle_lines.episode_id
      and e.status = 'published'
    )
  );

create policy "dictionary readable by authenticated" on public.dictionary_entries
  for select using (auth.uid() is not null);

create policy "dictionary readable publicly" on public.dictionary_entries
  for select using (true);

create policy "progress own all" on public.learning_progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "study plans own all" on public.study_plans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "repeat attempts own all" on public.repeat_attempts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "vocab items own all" on public.vocab_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
    and role = 'admin'
  );
$$;

create policy "admins manage series" on public.series
  for all using (public.is_admin()) with check (public.is_admin());

create policy "admins manage episodes" on public.episodes
  for all using (public.is_admin()) with check (public.is_admin());

create policy "admins manage subtitle lines" on public.subtitle_lines
  for all using (public.is_admin()) with check (public.is_admin());

create policy "admins manage import jobs" on public.admin_import_jobs
  for all using (public.is_admin()) with check (public.is_admin());

create policy "admins manage site settings" on public.site_settings
  for all using (public.is_admin()) with check (public.is_admin());
