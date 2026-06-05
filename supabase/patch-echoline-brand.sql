insert into public.site_settings (key, value, updated_at)
values (
  'global',
  jsonb_build_object(
    'appName', '追句 EchoLine',
    'workspaceSubtitle', '逐句看剧学英语工作台'
  ),
  now()
)
on conflict (key) do update
set
  value = public.site_settings.value || jsonb_build_object(
    'appName', '追句 EchoLine',
    'workspaceSubtitle', '逐句看剧学英语工作台'
  ),
  updated_at = now();
