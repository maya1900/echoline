insert into public.series (id, title, original_title, description, cover_url, difficulty, genre, status)
values
  (
    '00000000-0000-4000-8000-000000000001',
    '雨巷公寓',
    'Rain Alley',
    '一群新搬进伦敦老公寓的年轻人，在厨房、楼梯间和深夜便利店里练习把话说清楚。',
    'https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=1200&q=80',
    'B1',
    '生活 / 情景',
    'published'
  ),
  (
    '00000000-0000-4000-8000-000000000002',
    '九号站台',
    'Station Nine',
    '通勤路上的短对话，适合练习请求、确认、解释和轻松寒暄。',
    'https://images.unsplash.com/photo-1517586979036-b7d1e86b3345?auto=format&fit=crop&w=1200&q=80',
    'A2',
    '通勤 / 日常',
    'published'
  )
on conflict (id) do update set
  title = excluded.title,
  original_title = excluded.original_title,
  description = excluded.description,
  cover_url = excluded.cover_url,
  difficulty = excluded.difficulty,
  genre = excluded.genre,
  status = excluded.status;

insert into public.episodes (id, series_id, season_number, episode_number, title, description, media_url, duration_seconds, status)
values
  (
    '00000000-0000-4000-8000-000000000101',
    '00000000-0000-4000-8000-000000000001',
    1,
    1,
    'The Spare Key',
    'Maya 找不到备用钥匙，只好向刚认识的邻居开口求助。',
    '/mock/rain-alley-episode-1.mp4',
    1320,
    'published'
  ),
  (
    '00000000-0000-4000-8000-000000000102',
    '00000000-0000-4000-8000-000000000001',
    1,
    2,
    'Too Much Pepper',
    '一锅过辣的汤让所有人开始交换道歉和补救方式。',
    '/mock/rain-alley-episode-2.mp4',
    1410,
    'published'
  ),
  (
    '00000000-0000-4000-8000-000000000103',
    '00000000-0000-4000-8000-000000000002',
    1,
    1,
    'Mind the Gap',
    '延误通知之后，三位陌生人开始拼一条备用路线。',
    '/mock/station-nine-episode-1.mp4',
    1080,
    'published'
  )
on conflict (series_id, season_number, episode_number) do update set
  title = excluded.title,
  description = excluded.description,
  media_url = excluded.media_url,
  duration_seconds = excluded.duration_seconds,
  status = excluded.status;

insert into public.subtitle_lines (id, episode_id, line_index, start_ms, end_ms, english_text, chinese_text, difficulty, keywords)
values
  ('00000000-0000-4000-8000-000000001001', '00000000-0000-4000-8000-000000000101', 1, 12200, 15400, 'I thought the spare key was under the blue flowerpot.', '我以为备用钥匙在蓝色花盆下面。', 'B1', array['thought', 'spare', 'flowerpot']),
  ('00000000-0000-4000-8000-000000001002', '00000000-0000-4000-8000-000000000101', 2, 15800, 18900, 'It was, until your cat decided to redecorate the hallway.', '本来是在那儿，直到你的猫决定重新布置走廊。', 'B1', array['until', 'decided', 'redecorate']),
  ('00000000-0000-4000-8000-000000001003', '00000000-0000-4000-8000-000000000101', 3, 19600, 22500, 'Could you lend me your phone for a minute?', '你能把手机借我一分钟吗？', 'A2', array['lend', 'minute']),
  ('00000000-0000-4000-8000-000000001004', '00000000-0000-4000-8000-000000000101', 4, 23100, 26300, 'Sure, but promise you will not call the landlord before coffee.', '当然，但答应我喝咖啡前别给房东打电话。', 'B1', array['promise', 'landlord']),
  ('00000000-0000-4000-8000-000000001005', '00000000-0000-4000-8000-000000000101', 5, 27100, 30400, 'Deal. I make terrible decisions without breakfast.', '成交。我没吃早饭时总会做糟糕决定。', 'B1', array['deal', 'terrible', 'decisions']),
  ('00000000-0000-4000-8000-000000001006', '00000000-0000-4000-8000-000000000102', 1, 8400, 11200, 'Did anyone check how much pepper was in that jar?', '有人看过那个罐子里到底有多少胡椒吗？', 'A2', array['check', 'pepper', 'jar']),
  ('00000000-0000-4000-8000-000000001007', '00000000-0000-4000-8000-000000000102', 2, 11800, 15100, 'I only added a little, but the spoon had other plans.', '我只加了一点点，但那把勺子显然另有打算。', 'B1', array['added', 'little', 'plans']),
  ('00000000-0000-4000-8000-000000001008', '00000000-0000-4000-8000-000000000103', 1, 6200, 9300, 'The next train is delayed by twelve minutes.', '下一班车晚点十二分钟。', 'A2', array['train', 'delayed', 'minutes']),
  ('00000000-0000-4000-8000-000000001009', '00000000-0000-4000-8000-000000000103', 2, 9800, 12800, 'We can take the bus if we leave now.', '如果现在走，我们可以坐公交。', 'A2', array['bus', 'leave', 'now'])
on conflict (episode_id, line_index) do update set
  start_ms = excluded.start_ms,
  end_ms = excluded.end_ms,
  english_text = excluded.english_text,
  chinese_text = excluded.chinese_text,
  difficulty = excluded.difficulty,
  keywords = excluded.keywords;

insert into public.dictionary_entries (word, phonetic, translation, definition, pos, frq)
values
  ('spare', '/sper/', '备用的；多余的', 'I thought the spare key was under the blue flowerpot.', 'adj', 1200),
  ('landlord', '/ˈlændlɔːrd/', '房东', 'You will not call the landlord before coffee.', 'n', 4500),
  ('redecorate', '/ˌriːˈdekəreɪt/', '重新装饰；重新布置', 'Your cat decided to redecorate the hallway.', 'v', 9200),
  ('pepper', '/ˈpepər/', '胡椒；辣椒粉', 'Did anyone check how much pepper was in that jar.', 'n', 2400),
  ('delayed', '/dɪˈleɪd/', '延迟的；晚点的', 'The next train is delayed by twelve minutes.', 'adj', 3100)
on conflict (word) do update set
  phonetic = excluded.phonetic,
  translation = excluded.translation,
  definition = excluded.definition,
  pos = excluded.pos,
  frq = excluded.frq;
