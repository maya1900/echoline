import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  adminImportJobs,
  dictionary,
  getEpisode as getMockEpisode,
  getSeriesForEpisode as getMockSeriesForEpisode,
  getSubtitlesForEpisode as getMockSubtitlesForEpisode,
  progressRows,
  progressSummary,
  series as mockSeries,
  studyPlan as mockStudyPlan,
  subtitleLines as mockSubtitleLines,
  vocabItems as mockVocabItems
} from "@/lib/mock-data";
import type { AdminImportJob, DictionaryEntry, Episode, Series, StudyPlan, SubtitleLine, VocabItem } from "@/lib/types";

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
  weeklyLines: number;
  averageAccuracy: number;
  totalMinutes: number;
};

type DbVocabItem = {
  id: string;
  word: string;
  phonetic: string | null;
  translation: string | null;
  context_sentence: string | null;
  status: "new" | "learning" | "mastered";
  review_count: number;
  due_at: string | null;
};

type DbAdminImportJob = {
  id: string;
  source_filename: string | null;
  status: string;
  parsed_lines: number;
  error_message: string | null;
  created_at: string;
};

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
    episodes: (row.episodes ?? []).map(mapEpisode)
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

async function getUserActivity(userId: string): Promise<UserActivity> {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return {
      completedMinutes: mockStudyPlan.completedMinutes,
      completedLines: mockStudyPlan.completedLines,
      completedRepeats: mockStudyPlan.completedRepeats,
      weeklyLines: progressSummary.weeklyLines,
      averageAccuracy: progressSummary.averageAccuracy,
      totalMinutes: progressSummary.totalMinutes
    };
  }

  const today = startOfTodayIso();
  const weekStart = sevenDaysAgoIso();
  const [todayProgress, weeklyProgress, attempts] = await Promise.all([
    supabase.from("learning_progress").select("subtitle_line_id,mode,repeat_count,playback_position_ms").eq("user_id", userId).gte("last_studied_at", today),
    supabase.from("learning_progress").select("subtitle_line_id,playback_position_ms").eq("user_id", userId).gte("last_studied_at", weekStart),
    supabase.from("repeat_attempts").select("accuracy,overall").eq("user_id", userId)
  ]);

  const todayRows = todayProgress.data ?? [];
  const weeklyRows = weeklyProgress.data ?? [];
  const attemptRows = attempts.data ?? [];
  const averageAccuracy =
    attemptRows.length > 0 ? Math.round(attemptRows.reduce((sum, row) => sum + (row.accuracy ?? row.overall ?? 0), 0) / attemptRows.length) : progressSummary.averageAccuracy;

  return {
    completedMinutes: Math.max(Math.round(todayRows.reduce((sum, row) => sum + (row.playback_position_ms ?? 0), 0) / 60000), mockStudyPlan.completedMinutes),
    completedLines: new Set(todayRows.map((row) => row.subtitle_line_id).filter(Boolean)).size || mockStudyPlan.completedLines,
    completedRepeats: todayRows.filter((row) => row.mode === "repeat" || row.mode === "call_response").reduce((sum, row) => sum + (row.repeat_count ?? 1), 0) || mockStudyPlan.completedRepeats,
    weeklyLines: new Set(weeklyRows.map((row) => row.subtitle_line_id).filter(Boolean)).size || progressSummary.weeklyLines,
    averageAccuracy,
    totalMinutes: Math.max(Math.round(weeklyRows.reduce((sum, row) => sum + (row.playback_position_ms ?? 0), 0) / 60000), progressSummary.totalMinutes)
  };
}

function mapVocabItem(row: DbVocabItem): VocabItem {
  return {
    id: row.id,
    word: row.word,
    phonetic: row.phonetic ?? "",
    translation: row.translation ?? "",
    contextSentence: row.context_sentence ?? "",
    status: row.status,
    reviewCount: row.review_count,
    dueAt: row.due_at ? new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric" }).format(new Date(row.due_at)) : "今天"
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
    return mockSeries;
  }

  const { data, error } = await supabase
    .from("series")
    .select("id,title,original_title,description,cover_url,difficulty,genre,episodes(id,series_id,season_number,episode_number,title,description,media_url,duration_seconds)")
    .eq("status", "published")
    .order("created_at", { ascending: true });

  if (error || !data) {
    return mockSeries;
  }

  return (data as DbSeries[]).map(mapSeries);
}

export async function getEpisode(id: string): Promise<Episode | undefined> {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return getMockEpisode(id);
  }

  const { data, error } = await supabase
    .from("episodes")
    .select("id,series_id,season_number,episode_number,title,description,media_url,duration_seconds")
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();

  if (error || !data) {
    return getMockEpisode(id);
  }

  return mapEpisode(data as DbEpisode);
}

export async function getSeriesForEpisode(episodeId: string): Promise<Series | undefined> {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return getMockSeriesForEpisode(episodeId);
  }

  const episode = await getEpisode(episodeId);

  if (!episode) {
    return getMockSeriesForEpisode(episodeId);
  }

  const { data, error } = await supabase
    .from("series")
    .select("id,title,original_title,description,cover_url,difficulty,genre,episodes(id,series_id,season_number,episode_number,title,description,media_url,duration_seconds)")
    .eq("id", episode.seriesId)
    .maybeSingle();

  if (error || !data) {
    return getMockSeriesForEpisode(episodeId);
  }

  return mapSeries(data as DbSeries);
}

export async function getSubtitlesForEpisode(episodeId: string): Promise<SubtitleLine[]> {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return getMockSubtitlesForEpisode(episodeId);
  }

  const { data, error } = await supabase
    .from("subtitle_lines")
    .select("id,episode_id,line_index,start_ms,end_ms,english_text,chinese_text,difficulty,keywords")
    .eq("episode_id", episodeId)
    .order("line_index", { ascending: true });

  if (error || !data) {
    return getMockSubtitlesForEpisode(episodeId);
  }

  return (data as DbSubtitleLine[]).map(mapSubtitleLine);
}

export async function getStudyPlan(): Promise<StudyPlan> {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return mockStudyPlan;
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return mockStudyPlan;
  }

  const { data, error } = await supabase.from("study_plans").select("daily_minutes,daily_lines,daily_repeats").eq("user_id", user.id).maybeSingle();

  if (error || !data) {
    return mockStudyPlan;
  }

  const activity = await getUserActivity(user.id);
  return {
    ...mapStudyPlan(data as DbStudyPlan),
    completedMinutes: activity.completedMinutes,
    completedLines: activity.completedLines,
    completedRepeats: activity.completedRepeats
  };
}

export async function listVocabItems(status?: string | null, query = ""): Promise<VocabItem[]> {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return mockVocabItems.filter((item) => {
      const matchesStatus = !status || status === "all" || item.status === status;
      const matchesQuery = `${item.word} ${item.translation} ${item.contextSentence}`.toLowerCase().includes(query.toLowerCase());
      return matchesStatus && matchesQuery;
    });
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return mockVocabItems;
  }

  let request = supabase.from("vocab_items").select("id,word,phonetic,translation,context_sentence,status,review_count,due_at").eq("user_id", user.id);

  if (status && status !== "all") {
    request = request.eq("status", status);
  }

  const { data, error } = await request.order("due_at", { ascending: true, nullsFirst: true });

  if (error || !data) {
    return mockVocabItems;
  }

  const normalizedQuery = query.toLowerCase();
  return (data as DbVocabItem[]).map(mapVocabItem).filter((item) => `${item.word} ${item.translation} ${item.contextSentence}`.toLowerCase().includes(normalizedQuery));
}

export async function defineWord(word: string): Promise<DictionaryEntry | undefined> {
  const normalizedWord = word.toLowerCase().trim();
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return dictionary.get(normalizedWord);
  }

  const { data, error } = await supabase.from("dictionary_entries").select("word,phonetic,translation,definition").eq("word", normalizedWord).maybeSingle();

  if (error || !data) {
    return dictionary.get(normalizedWord);
  }

  return data as DictionaryEntry;
}

export async function listAdminImportJobs(): Promise<AdminImportJob[]> {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return adminImportJobs;
  }

  const { data, error } = await supabase.from("admin_import_jobs").select("id,source_filename,status,parsed_lines,error_message,created_at").order("created_at", { ascending: false });

  if (error || !data) {
    return adminImportJobs;
  }

  return (data as DbAdminImportJob[]).map(mapAdminImportJob);
}

export async function getProgressData() {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return { summary: progressSummary, rows: progressRows };
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { summary: progressSummary, rows: progressRows };
  }

  const [plan, activity] = await Promise.all([getStudyPlan(), getUserActivity(user.id)]);
  const summary = {
    ...progressSummary,
    weeklyLines: activity.weeklyLines,
    averageAccuracy: activity.averageAccuracy,
    totalMinutes: activity.totalMinutes
  };
  const rows = [
    { id: "minutes", label: "今日分钟", value: plan.completedMinutes, target: plan.dailyMinutes, tone: "green" as const },
    { id: "lines", label: "今日句子", value: plan.completedLines, target: plan.dailyLines, tone: "amber" as const },
    { id: "repeats", label: "今日跟读", value: plan.completedRepeats, target: plan.dailyRepeats, tone: "ink" as const },
    { id: "accuracy", label: "内容正确率", value: activity.averageAccuracy, target: 90, tone: "red" as const }
  ];

  return { summary, rows };
}

export function getMockSubtitleLine(id: string) {
  return mockSubtitleLines.find((line) => line.id === id);
}
