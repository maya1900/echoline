import { createSupabaseServerClient } from "@/lib/supabase/server";
import { explainWordInChinese } from "@/lib/dictionary/ai";
import { getLookupCandidates, lookupFallbackDictionary, normalizeLookupWord } from "@/lib/dictionary/fallback";
import type { AdminImportJob, DictionaryEntry, Episode, ProgressRow, ProgressSummary, Series, StudyPlan, SubtitleLine, VocabItem } from "@/lib/types";

type DbEpisode = {
  id: string;
  series_id: string;
  season_number: number;
  episode_number: number;
  title: string;
  description: string | null;
  media_url: string | null;
  duration_seconds: number | null;
};

type DbSeries = {
  id: string;
  title: string;
  original_title: string | null;
  description: string | null;
  cover_url: string | null;
  difficulty: string;
  genre: string | null;
  episodes?: DbEpisode[];
};

type DbSubtitleLine = {
  id: string;
  episode_id: string;
  line_index: number;
  start_ms: number;
  end_ms: number;
  english_text: string;
  chinese_text: string | null;
  difficulty: string | null;
  keywords: string[];
};

type DbStudyPlan = {
  daily_minutes: number;
  daily_lines: number;
  daily_repeats: number;
};

type UserActivity = {
  completedMinutes: number;
  completedLines: number;
  completedRepeats: number;
  streakDays: number;
  weeklyLines: number;
  averageAccuracy: number;
  totalMinutes: number;
};

type SupabaseServerClient = NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;

type DbVocabItem = {
  id: string;
  word: string;
  phonetic: string | null;
  translation: string | null;
  context_sentence: string | null;
  status: "new" | "learning" | "mastered";
  review_count: number;
  ease: number;
  interval_days: number;
  due_at: string | null;
  last_reviewed_at: string | null;
};

type DbAdminImportJob = {
  id: string;
  source_filename: string | null;
  status: string;
  parsed_lines: number;
  error_message: string | null;
  created_at: string;
};

const defaultStudyPlan: StudyPlan = {
  dailyMinutes: 25,
  dailyLines: 18,
  dailyRepeats: 8,
  completedMinutes: 0,
  completedLines: 0,
  completedRepeats: 0
};

const defaultProgressSummary: ProgressSummary = {
  streakDays: 0,
  weeklyLines: 0,
  averageAccuracy: 0,
  totalMinutes: 0
};

function getProgressRows(plan: StudyPlan, activity: UserActivity): ProgressRow[] {
  return [
    { id: "minutes", label: "今日分钟", value: plan.completedMinutes, target: plan.dailyMinutes, tone: "green" },
    { id: "lines", label: "今日句子", value: plan.completedLines, target: plan.dailyLines, tone: "amber" },
    { id: "repeats", label: "今日跟读", value: plan.completedRepeats, target: plan.dailyRepeats, tone: "ink" },
    { id: "accuracy", label: "内容正确率", value: activity.averageAccuracy, target: 90, tone: "red" }
  ];
}

function mapEpisode(row: DbEpisode): Episode {
  return {
    id: row.id,
    seriesId: row.series_id,
    seasonNumber: row.season_number,
    episodeNumber: row.episode_number,
    title: row.title,
    description: row.description ?? "",
    durationSeconds: row.duration_seconds ?? 0,
    mediaUrl: row.media_url ?? "",
    progress: 0
  };
}

function sortEpisodes(episodes: Episode[]) {
  return [...episodes].sort((left, right) => {
    if (left.seasonNumber !== right.seasonNumber) {
      return left.seasonNumber - right.seasonNumber;
    }

    return left.episodeNumber - right.episodeNumber;
  });
}

function mapSeries(row: DbSeries): Series {
  return {
    id: row.id,
    title: row.title,
    originalTitle: row.original_title ?? "",
    description: row.description ?? "",
    coverUrl: row.cover_url ?? "",
    difficulty: row.difficulty,
    genre: row.genre ?? "",
    progress: 0,
    episodes: sortEpisodes((row.episodes ?? []).map(mapEpisode))
  };
}

function mapSubtitleLine(row: DbSubtitleLine): SubtitleLine {
  return {
    id: row.id,
    episodeId: row.episode_id,
    lineIndex: row.line_index,
    startMs: row.start_ms,
    endMs: row.end_ms,
    englishText: row.english_text,
    chineseText: row.chinese_text ?? "",
    difficulty: row.difficulty ?? "",
    keywords: row.keywords ?? []
  };
}

function mapStudyPlan(row: DbStudyPlan): StudyPlan {
  return {
    dailyMinutes: row.daily_minutes,
    dailyLines: row.daily_lines,
    dailyRepeats: row.daily_repeats,
    completedMinutes: 0,
    completedLines: 0,
    completedRepeats: 0
  };
}

function startOfTodayIso() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

function sevenDaysAgoIso() {
  const date = new Date();
  date.setDate(date.getDate() - 7);
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

function dateKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function calculateStreakDays(studiedAt: string[]) {
  const studiedDays = new Set(studiedAt.map((value) => dateKey(new Date(value))));
  let streak = 0;
  const cursor = new Date();

  while (studiedDays.has(dateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

async function hydrateSeriesProgress(seriesList: Series[], userId: string, supabase: SupabaseServerClient): Promise<Series[]> {
  const episodeIds = seriesList.flatMap((item) => item.episodes.map((episode) => episode.id));

  if (episodeIds.length === 0) {
    return seriesList;
  }

  const [subtitleResult, progressResult] = await Promise.all([
    supabase.from("subtitle_lines").select("id,episode_id").in("episode_id", episodeIds),
    supabase.from("learning_progress").select("episode_id,subtitle_line_id").eq("user_id", userId).eq("completed", true).in("episode_id", episodeIds)
  ]);

  if (subtitleResult.error || progressResult.error) {
    return seriesList;
  }

  const totalByEpisode = new Map<string, number>();
  for (const row of (subtitleResult.data ?? []) as Array<{ id: string; episode_id: string }>) {
    totalByEpisode.set(row.episode_id, (totalByEpisode.get(row.episode_id) ?? 0) + 1);
  }

  const completedByEpisode = new Map<string, Set<string>>();
  for (const row of (progressResult.data ?? []) as Array<{ episode_id: string; subtitle_line_id: string }>) {
    const completedLines = completedByEpisode.get(row.episode_id) ?? new Set<string>();
    completedLines.add(row.subtitle_line_id);
    completedByEpisode.set(row.episode_id, completedLines);
  }

  return seriesList.map((item) => {
    let seriesTotal = 0;
    let seriesCompleted = 0;
    const episodes = item.episodes.map((episode) => {
      const total = totalByEpisode.get(episode.id) ?? 0;
      const completed = completedByEpisode.get(episode.id)?.size ?? 0;
      const progress = total > 0 ? Math.min(Math.round((completed / total) * 100), 100) : 0;

      seriesTotal += total;
      seriesCompleted += completed;

      return { ...episode, progress };
    });

    return {
      ...item,
      progress: seriesTotal > 0 ? Math.min(Math.round((seriesCompleted / seriesTotal) * 100), 100) : 0,
      episodes
    };
  });
}

async function getUserActivity(userId: string): Promise<UserActivity> {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return {
      completedMinutes: 0,
      completedLines: 0,
      completedRepeats: 0,
      streakDays: 0,
      weeklyLines: 0,
      averageAccuracy: 0,
      totalMinutes: 0
    };
  }

  const today = startOfTodayIso();
  const weekStart = sevenDaysAgoIso();
  const [todayProgress, weeklyProgress, allProgress, attempts] = await Promise.all([
    supabase.from("learning_progress").select("subtitle_line_id,mode,repeat_count,playback_position_ms").eq("user_id", userId).gte("last_studied_at", today),
    supabase.from("learning_progress").select("subtitle_line_id,playback_position_ms,last_studied_at").eq("user_id", userId).gte("last_studied_at", weekStart),
    supabase.from("learning_progress").select("playback_position_ms,last_studied_at").eq("user_id", userId),
    supabase.from("repeat_attempts").select("accuracy,overall").eq("user_id", userId)
  ]);

  const todayRows = todayProgress.data ?? [];
  const weeklyRows = weeklyProgress.data ?? [];
  const allRows = allProgress.data ?? [];
  const attemptRows = attempts.data ?? [];
  const averageAccuracy =
    attemptRows.length > 0 ? Math.round(attemptRows.reduce((sum, row) => sum + (row.accuracy ?? row.overall ?? 0), 0) / attemptRows.length) : 0;

  return {
    completedMinutes: Math.round(todayRows.reduce((sum, row) => sum + (row.playback_position_ms ?? 0), 0) / 60000),
    completedLines: new Set(todayRows.map((row) => row.subtitle_line_id).filter(Boolean)).size,
    completedRepeats: todayRows.filter((row) => row.mode === "repeat" || row.mode === "call_response").reduce((sum, row) => sum + (row.repeat_count ?? 1), 0),
    streakDays: calculateStreakDays(allRows.map((row) => row.last_studied_at).filter(Boolean)),
    weeklyLines: new Set(weeklyRows.map((row) => row.subtitle_line_id).filter(Boolean)).size,
    averageAccuracy,
    totalMinutes: Math.round(allRows.reduce((sum, row) => sum + (row.playback_position_ms ?? 0), 0) / 60000)
  };
}

function mapVocabItem(row: DbVocabItem): VocabItem {
  const dueDate = row.due_at ? new Date(row.due_at) : null;

  return {
    id: row.id,
    word: row.word,
    phonetic: row.phonetic ?? "",
    translation: row.translation ?? "",
    contextSentence: row.context_sentence ?? "",
    status: row.status,
    reviewCount: row.review_count,
    dueAt: dueDate ? new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric" }).format(dueDate) : "今天",
    dueAtIso: row.due_at,
    isDue: !dueDate || dueDate.getTime() <= Date.now(),
    ease: Number(row.ease ?? 2.5),
    intervalDays: row.interval_days ?? 0,
    lastReviewedAt: row.last_reviewed_at
  };
}

function mapAdminImportJob(row: DbAdminImportJob): AdminImportJob {
  return {
    id: row.id,
    title: row.source_filename ?? "导入任务",
    status: row.status === "pending" ? "queued" : row.status === "done" ? "completed" : (row.status as AdminImportJob["status"]),
    result: row.error_message ?? `解析 ${row.parsed_lines} 行字幕`,
    createdAt: new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(row.created_at))
  };
}

export async function listSeries(): Promise<Series[]> {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("series")
    .select("id,title,original_title,description,cover_url,difficulty,genre,episodes(id,series_id,season_number,episode_number,title,description,media_url,duration_seconds)")
    .eq("status", "published")
    .order("created_at", { ascending: true });

  if (error || !data || data.length === 0) {
    return [];
  }

  const mappedSeries = (data as DbSeries[]).map(mapSeries);
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return mappedSeries;
  }

  return hydrateSeriesProgress(mappedSeries, user.id, supabase);
}

export async function getEpisode(id: string): Promise<Episode | undefined> {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return undefined;
  }

  const { data, error } = await supabase
    .from("episodes")
    .select("id,series_id,season_number,episode_number,title,description,media_url,duration_seconds")
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();

  if (error || !data) {
    return undefined;
  }

  return mapEpisode(data as DbEpisode);
}

export async function getSeriesForEpisode(episodeId: string): Promise<Series | undefined> {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return undefined;
  }

  const episode = await getEpisode(episodeId);

  if (!episode) {
    return undefined;
  }

  const { data, error } = await supabase
    .from("series")
    .select("id,title,original_title,description,cover_url,difficulty,genre,episodes(id,series_id,season_number,episode_number,title,description,media_url,duration_seconds)")
    .eq("id", episode.seriesId)
    .maybeSingle();

  if (error || !data) {
    return undefined;
  }

  return mapSeries(data as DbSeries);
}

export async function getSubtitlesForEpisode(episodeId: string): Promise<SubtitleLine[]> {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("subtitle_lines")
    .select("id,episode_id,line_index,start_ms,end_ms,english_text,chinese_text,difficulty,keywords")
    .eq("episode_id", episodeId)
    .order("line_index", { ascending: true });

  if (error || !data || data.length === 0) {
    return [];
  }

  return (data as DbSubtitleLine[]).map(mapSubtitleLine);
}

export async function getResumeSubtitleLineId(episodeId: string, lines: SubtitleLine[]): Promise<string | undefined> {
  const supabase = await createSupabaseServerClient();

  if (!supabase || lines.length === 0) {
    return lines[0]?.id;
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return lines[0]?.id;
  }

  const { data, error } = await supabase
    .from("learning_progress")
    .select("subtitle_line_id,completed,last_studied_at")
    .eq("user_id", user.id)
    .eq("episode_id", episodeId)
    .order("last_studied_at", { ascending: false })
    .limit(20);

  if (error || !data || data.length === 0) {
    return lines[0]?.id;
  }

  const lineIds = new Set(lines.map((line) => line.id));
  const latest = data.find((row) => typeof row.subtitle_line_id === "string" && lineIds.has(row.subtitle_line_id));

  if (!latest?.subtitle_line_id) {
    return lines[0]?.id;
  }

  const latestIndex = lines.findIndex((line) => line.id === latest.subtitle_line_id);

  if (latestIndex < 0) {
    return lines[0]?.id;
  }

  if (latest.completed && latestIndex < lines.length - 1) {
    return lines[latestIndex + 1].id;
  }

  return lines[latestIndex].id;
}

export async function getStudyPlan(): Promise<StudyPlan> {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return defaultStudyPlan;
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return defaultStudyPlan;
  }

  const { data, error } = await supabase.from("study_plans").select("daily_minutes,daily_lines,daily_repeats").eq("user_id", user.id).maybeSingle();

  if (error || !data) {
    return defaultStudyPlan;
  }

  const activity = await getUserActivity(user.id);
  return {
    ...mapStudyPlan(data as DbStudyPlan),
    completedMinutes: activity.completedMinutes,
    completedLines: activity.completedLines,
    completedRepeats: activity.completedRepeats
  };
}

export async function countDueVocabItems(): Promise<number> {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return 0;
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return 0;
  }

  const { count, error } = await supabase
    .from("vocab_items")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .or(`due_at.is.null,due_at.lte.${new Date().toISOString()}`);

  if (error) {
    return 0;
  }

  return count ?? 0;
}

export async function listVocabItems(status?: string | null, query = ""): Promise<VocabItem[]> {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return [];
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return [];
  }

  let request = supabase
    .from("vocab_items")
    .select("id,word,phonetic,translation,context_sentence,status,review_count,ease,interval_days,due_at,last_reviewed_at")
    .eq("user_id", user.id);

  if (status === "due") {
    request = request.or(`due_at.is.null,due_at.lte.${new Date().toISOString()}`);
  } else if (status && status !== "all") {
    request = request.eq("status", status);
  }

  const { data, error } = await request.order("due_at", { ascending: true, nullsFirst: true });

  if (error || !data) {
    return [];
  }

  const normalizedQuery = query.toLowerCase();
  return (data as DbVocabItem[]).map(mapVocabItem).filter((item) => `${item.word} ${item.translation} ${item.contextSentence}`.toLowerCase().includes(normalizedQuery));
}

type DefineWordOptions = {
  englishSentence?: string;
  chineseSentence?: string;
};

function decorateDictionaryEntry(entry: DictionaryEntry, source: DictionaryEntry["source"]): DictionaryEntry {
  return {
    ...entry,
    source,
    inContext: entry.inContext ?? entry.translation,
    note: entry.note ?? "结合当前字幕记住这个意思。"
  };
}

async function cacheDictionaryEntry(entry: DictionaryEntry) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return;
  }

  await supabase.from("dictionary_entries").upsert({
    word: entry.word,
    phonetic: entry.phonetic,
    translation: entry.translation,
    definition: entry.definition,
    pos: entry.partOfSpeech
  });
}

export async function defineWord(word: string, options: DefineWordOptions = {}): Promise<DictionaryEntry | undefined> {
  const normalizedWord = normalizeLookupWord(word);
  const candidates = getLookupCandidates(normalizedWord);
  const supabase = await createSupabaseServerClient();
  const fallbackEntry = lookupFallbackDictionary(normalizedWord);

  if (!supabase) {
    return fallbackEntry ? decorateDictionaryEntry(fallbackEntry, "fallback") : undefined;
  }

  const { data, error } = await supabase.from("dictionary_entries").select("word,phonetic,translation,definition,pos").in("word", candidates);

  if (!error && data && data.length > 0) {
    const row = data.find((item) => item.word === normalizedWord) ?? data[0];

    return decorateDictionaryEntry(
      {
        word: row.word,
        phonetic: row.phonetic ?? "",
        translation: row.translation ?? "",
        definition: row.definition ?? "",
        partOfSpeech: row.pos ?? undefined
      },
      "supabase"
    );
  }

  if (fallbackEntry) {
    return decorateDictionaryEntry(fallbackEntry, "fallback");
  }

  const aiEntry = await explainWordInChinese({
    word: normalizedWord,
    englishSentence: options.englishSentence,
    chineseSentence: options.chineseSentence
  });

  if (aiEntry) {
    void cacheDictionaryEntry(aiEntry);
    return aiEntry;
  }

  return undefined;
}

export async function listAdminImportJobs(): Promise<AdminImportJob[]> {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase.from("admin_import_jobs").select("id,source_filename,status,parsed_lines,error_message,created_at").order("created_at", { ascending: false });

  if (error || !data) {
    return [];
  }

  return (data as DbAdminImportJob[]).map(mapAdminImportJob);
}

export async function getProgressData() {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return { summary: defaultProgressSummary, rows: getProgressRows(defaultStudyPlan, { completedMinutes: 0, completedLines: 0, completedRepeats: 0, streakDays: 0, weeklyLines: 0, averageAccuracy: 0, totalMinutes: 0 }) };
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { summary: defaultProgressSummary, rows: getProgressRows(defaultStudyPlan, { completedMinutes: 0, completedLines: 0, completedRepeats: 0, streakDays: 0, weeklyLines: 0, averageAccuracy: 0, totalMinutes: 0 }) };
  }

  const [plan, activity] = await Promise.all([getStudyPlan(), getUserActivity(user.id)]);
  const summary = {
    streakDays: activity.streakDays,
    weeklyLines: activity.weeklyLines,
    averageAccuracy: activity.averageAccuracy,
    totalMinutes: activity.totalMinutes
  };

  return { summary, rows: getProgressRows(plan, activity) };
}
