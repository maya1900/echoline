import { and, asc, count, desc, eq, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/bootstrap";
import { getDb, type AppDb } from "@/lib/db/client";
import {
  adminImportJobs,
  dictionaryEntries,
  episodes,
  learningProgress,
  repeatAttempts,
  series as seriesTable,
  studyPlans,
  subtitleLines,
  vocabItems,
  type EpisodeRow,
  type SeriesRow,
  type SubtitleLineRow,
  type VocabItemRow
} from "@/lib/db/schema";
import { explainWordInChinese } from "@/lib/dictionary/ai";
import { getLookupCandidates, lookupFallbackDictionary, normalizeLookupWord } from "@/lib/dictionary/fallback";
import type { AdminImportJob, DictionaryEntry, Episode, ProgressRow, ProgressSummary, Series, StudyPlan, SubtitleLine, VocabItem } from "@/lib/types";

type SeriesWithEpisodes = Series & {
  episodes: Episode[];
};

type DbStudyPlan = {
  dailyMinutes: number;
  dailyLines: number;
  dailyRepeats: number;
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

type DbAdminImportJob = {
  id: string;
  sourceFilename: string | null;
  status: string;
  parsedLines: number;
  errorMessage: string | null;
  createdAt: Date;
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

function mapEpisode(row: EpisodeRow): Episode {
  return {
    id: row.id,
    seriesId: row.seriesId,
    seasonNumber: row.seasonNumber,
    episodeNumber: row.episodeNumber,
    title: row.title,
    description: row.description ?? "",
    durationSeconds: row.durationSeconds ?? 0,
    mediaUrl: row.mediaUrl ?? "",
    progress: 0
  };
}

function sortEpisodes(episodeList: Episode[]) {
  return [...episodeList].sort((left, right) => {
    if (left.seasonNumber !== right.seasonNumber) {
      return left.seasonNumber - right.seasonNumber;
    }

    return left.episodeNumber - right.episodeNumber;
  });
}

function mapSeries(row: SeriesRow, episodeRows: EpisodeRow[] = []): Series {
  return {
    id: row.id,
    title: row.title,
    originalTitle: row.originalTitle ?? "",
    description: row.description ?? "",
    coverUrl: row.coverUrl ?? "",
    difficulty: row.difficulty,
    genre: row.genre ?? "",
    progress: 0,
    episodes: sortEpisodes(episodeRows.map(mapEpisode))
  };
}

function mapSubtitleLine(row: SubtitleLineRow): SubtitleLine {
  return {
    id: row.id,
    episodeId: row.episodeId,
    lineIndex: row.lineIndex,
    startMs: row.startMs,
    endMs: row.endMs,
    englishText: row.englishText,
    chineseText: row.chineseText ?? "",
    difficulty: row.difficulty ?? "",
    keywords: row.keywords ?? []
  };
}

function mapStudyPlan(row: DbStudyPlan): StudyPlan {
  return {
    dailyMinutes: row.dailyMinutes,
    dailyLines: row.dailyLines,
    dailyRepeats: row.dailyRepeats,
    completedMinutes: 0,
    completedLines: 0,
    completedRepeats: 0
  };
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function sevenDaysAgo() {
  const date = new Date();
  date.setDate(date.getDate() - 7);
  date.setHours(0, 0, 0, 0);
  return date;
}

function dateKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function calculateStreakDays(studiedAt: Array<Date | string>) {
  const studiedDays = new Set(studiedAt.map((value) => dateKey(new Date(value))));
  let streak = 0;
  const cursor = new Date();

  while (studiedDays.has(dateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

async function hydrateSeriesProgress(seriesList: Series[], userId: string, db: AppDb): Promise<Series[]> {
  const episodeIds = seriesList.flatMap((item) => item.episodes.map((episode) => episode.id));

  if (episodeIds.length === 0) {
    return seriesList;
  }

  const [subtitleRows, progressRows] = await Promise.all([
    db
      .select({ id: subtitleLines.id, episodeId: subtitleLines.episodeId })
      .from(subtitleLines)
      .where(inArray(subtitleLines.episodeId, episodeIds)),
    db
      .select({ episodeId: learningProgress.episodeId, subtitleLineId: learningProgress.subtitleLineId })
      .from(learningProgress)
      .where(and(eq(learningProgress.userId, userId), eq(learningProgress.completed, true), inArray(learningProgress.episodeId, episodeIds)))
  ]);

  const totalByEpisode = new Map<string, number>();
  for (const row of subtitleRows) {
    totalByEpisode.set(row.episodeId, (totalByEpisode.get(row.episodeId) ?? 0) + 1);
  }

  const completedByEpisode = new Map<string, Set<string>>();
  for (const row of progressRows) {
    if (!row.episodeId || !row.subtitleLineId) {
      continue;
    }

    const completedLines = completedByEpisode.get(row.episodeId) ?? new Set<string>();
    completedLines.add(row.subtitleLineId);
    completedByEpisode.set(row.episodeId, completedLines);
  }

  return seriesList.map((item) => {
    let seriesTotal = 0;
    let seriesCompleted = 0;
    const itemEpisodes = item.episodes.map((episode) => {
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
      episodes: itemEpisodes
    };
  });
}

async function getUserActivity(userId: string): Promise<UserActivity> {
  const db = getDb();

  if (!db) {
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

  const today = startOfToday();
  const weekStart = sevenDaysAgo();
  const [todayProgress, weeklyProgress, allProgress, attempts] = await Promise.all([
    db
      .select({
        subtitleLineId: learningProgress.subtitleLineId,
        mode: learningProgress.mode,
        repeatCount: learningProgress.repeatCount,
        playbackPositionMs: learningProgress.playbackPositionMs
      })
      .from(learningProgress)
      .where(and(eq(learningProgress.userId, userId), gte(learningProgress.lastStudiedAt, today))),
    db
      .select({
        subtitleLineId: learningProgress.subtitleLineId,
        playbackPositionMs: learningProgress.playbackPositionMs,
        lastStudiedAt: learningProgress.lastStudiedAt
      })
      .from(learningProgress)
      .where(and(eq(learningProgress.userId, userId), gte(learningProgress.lastStudiedAt, weekStart))),
    db
      .select({
        playbackPositionMs: learningProgress.playbackPositionMs,
        lastStudiedAt: learningProgress.lastStudiedAt
      })
      .from(learningProgress)
      .where(eq(learningProgress.userId, userId)),
    db
      .select({ accuracy: repeatAttempts.accuracy, overall: repeatAttempts.overall })
      .from(repeatAttempts)
      .where(eq(repeatAttempts.userId, userId))
  ]);

  const averageAccuracy =
    attempts.length > 0 ? Math.round(attempts.reduce((sum, row) => sum + (row.accuracy ?? row.overall ?? 0), 0) / attempts.length) : 0;

  return {
    completedMinutes: Math.round(todayProgress.reduce((sum, row) => sum + (row.playbackPositionMs ?? 0), 0) / 60000),
    completedLines: new Set(todayProgress.map((row) => row.subtitleLineId).filter(Boolean)).size,
    completedRepeats: todayProgress.filter((row) => row.mode === "repeat" || row.mode === "call_response").reduce((sum, row) => sum + (row.repeatCount ?? 1), 0),
    streakDays: calculateStreakDays(allProgress.map((row) => row.lastStudiedAt).filter(Boolean)),
    weeklyLines: new Set(weeklyProgress.map((row) => row.subtitleLineId).filter(Boolean)).size,
    averageAccuracy,
    totalMinutes: Math.round(allProgress.reduce((sum, row) => sum + (row.playbackPositionMs ?? 0), 0) / 60000)
  };
}

function mapVocabItem(row: VocabItemRow): VocabItem {
  const dueDate = row.dueAt ? new Date(row.dueAt) : null;

  return {
    id: row.id,
    word: row.word,
    phonetic: row.phonetic ?? "",
    translation: row.translation ?? "",
    contextSentence: row.contextSentence ?? "",
    status: row.status as VocabItem["status"],
    reviewCount: row.reviewCount,
    dueAt: dueDate ? new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric" }).format(dueDate) : "今天",
    dueAtIso: row.dueAt ? row.dueAt.toISOString() : null,
    isDue: !dueDate || dueDate.getTime() <= Date.now(),
    ease: Number(row.ease ?? 2.5),
    intervalDays: row.intervalDays ?? 0,
    lastReviewedAt: row.lastReviewedAt ? row.lastReviewedAt.toISOString() : null
  };
}

function mapAdminImportJob(row: DbAdminImportJob): AdminImportJob {
  return {
    id: row.id,
    title: row.sourceFilename ?? "导入任务",
    status: row.status === "pending" ? "queued" : row.status === "done" ? "completed" : (row.status as AdminImportJob["status"]),
    result: row.errorMessage ?? `解析 ${row.parsedLines} 行字幕`,
    createdAt: new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(row.createdAt)
  };
}

function groupSeriesRows(rows: Array<{ series: SeriesRow; episode: EpisodeRow | null }>): SeriesWithEpisodes[] {
  const seriesById = new Map<string, { row: SeriesRow; episodes: EpisodeRow[] }>();

  for (const item of rows) {
    const existing = seriesById.get(item.series.id) ?? { row: item.series, episodes: [] };

    if (item.episode) {
      existing.episodes.push(item.episode);
    }

    seriesById.set(item.series.id, existing);
  }

  return [...seriesById.values()].map((item) => mapSeries(item.row, item.episodes));
}

export async function listSeries(): Promise<Series[]> {
  const db = getDb();

  if (!db) {
    return [];
  }

  const rows = await db
    .select({ series: seriesTable, episode: episodes })
    .from(seriesTable)
    .leftJoin(episodes, and(eq(episodes.seriesId, seriesTable.id), eq(episodes.status, "published")))
    .where(eq(seriesTable.status, "published"))
    .orderBy(asc(seriesTable.createdAt), asc(episodes.seasonNumber), asc(episodes.episodeNumber));

  if (rows.length === 0) {
    return [];
  }

  const mappedSeries = groupSeriesRows(rows);
  const user = await getCurrentUser();

  if (!user) {
    return mappedSeries;
  }

  return hydrateSeriesProgress(mappedSeries, user.id, db);
}

export async function getLastStudiedEpisodeId(episodeIds: string[]): Promise<string | undefined> {
  const db = getDb();
  const user = await getCurrentUser();

  if (!db || !user || episodeIds.length === 0) {
    return undefined;
  }

  const [data] = await db
    .select({ episodeId: learningProgress.episodeId })
    .from(learningProgress)
    .where(and(eq(learningProgress.userId, user.id), inArray(learningProgress.episodeId, episodeIds)))
    .orderBy(desc(learningProgress.lastStudiedAt))
    .limit(1);

  return data?.episodeId ?? undefined;
}

export async function getEpisode(id: string): Promise<Episode | undefined> {
  const db = getDb();

  if (!db) {
    return undefined;
  }

  const [data] = await db.select().from(episodes).where(and(eq(episodes.id, id), eq(episodes.status, "published"))).limit(1);
  return data ? mapEpisode(data) : undefined;
}

export async function getSeriesForEpisode(episodeId: string): Promise<Series | undefined> {
  const db = getDb();

  if (!db) {
    return undefined;
  }

  const episode = await getEpisode(episodeId);

  if (!episode) {
    return undefined;
  }

  const rows = await db
    .select({ series: seriesTable, episode: episodes })
    .from(seriesTable)
    .leftJoin(episodes, and(eq(episodes.seriesId, seriesTable.id), eq(episodes.status, "published")))
    .where(eq(seriesTable.id, episode.seriesId))
    .orderBy(asc(episodes.seasonNumber), asc(episodes.episodeNumber));

  return groupSeriesRows(rows)[0];
}

export async function getSubtitlesForEpisode(episodeId: string): Promise<SubtitleLine[]> {
  const db = getDb();

  if (!db) {
    return [];
  }

  const data = await db.select().from(subtitleLines).where(eq(subtitleLines.episodeId, episodeId)).orderBy(asc(subtitleLines.lineIndex));

  return data.map(mapSubtitleLine);
}

export async function getResumeSubtitleLineId(episodeId: string, lines: SubtitleLine[]): Promise<string | undefined> {
  const db = getDb();
  const user = await getCurrentUser();

  if (!db || !user || lines.length === 0) {
    return lines[0]?.id;
  }

  const data = await db
    .select({
      subtitleLineId: learningProgress.subtitleLineId,
      completed: learningProgress.completed,
      lastStudiedAt: learningProgress.lastStudiedAt
    })
    .from(learningProgress)
    .where(and(eq(learningProgress.userId, user.id), eq(learningProgress.episodeId, episodeId)))
    .orderBy(desc(learningProgress.lastStudiedAt))
    .limit(20);

  if (data.length === 0) {
    return lines[0]?.id;
  }

  const lineIds = new Set(lines.map((line) => line.id));
  const latest = data.find((row) => typeof row.subtitleLineId === "string" && lineIds.has(row.subtitleLineId));

  if (!latest?.subtitleLineId) {
    return lines[0]?.id;
  }

  const latestIndex = lines.findIndex((line) => line.id === latest.subtitleLineId);

  if (latestIndex < 0) {
    return lines[0]?.id;
  }

  if (latest.completed && latestIndex < lines.length - 1) {
    return lines[latestIndex + 1].id;
  }

  return lines[latestIndex].id;
}

export async function getStudyPlan(): Promise<StudyPlan> {
  const db = getDb();
  const user = await getCurrentUser();

  if (!db || !user) {
    return defaultStudyPlan;
  }

  const [data] = await db
    .select({
      dailyMinutes: studyPlans.dailyMinutes,
      dailyLines: studyPlans.dailyLines,
      dailyRepeats: studyPlans.dailyRepeats
    })
    .from(studyPlans)
    .where(eq(studyPlans.userId, user.id))
    .limit(1);

  if (!data) {
    return defaultStudyPlan;
  }

  const activity = await getUserActivity(user.id);
  return {
    ...mapStudyPlan(data),
    completedMinutes: activity.completedMinutes,
    completedLines: activity.completedLines,
    completedRepeats: activity.completedRepeats
  };
}

export async function countDueVocabItems(): Promise<number> {
  const db = getDb();
  const user = await getCurrentUser();

  if (!db || !user) {
    return 0;
  }

  const [result] = await db
    .select({ value: count() })
    .from(vocabItems)
    .where(and(eq(vocabItems.userId, user.id), or(isNull(vocabItems.dueAt), lte(vocabItems.dueAt, new Date()))));

  return result?.value ?? 0;
}

export async function listVocabItems(status?: string | null, query = ""): Promise<VocabItem[]> {
  const db = getDb();
  const user = await getCurrentUser();

  if (!db || !user) {
    return [];
  }

  const conditions = [eq(vocabItems.userId, user.id)];

  if (status === "due") {
    conditions.push(or(isNull(vocabItems.dueAt), lte(vocabItems.dueAt, new Date()))!);
  } else if (status && status !== "all") {
    conditions.push(eq(vocabItems.status, status));
  }

  const data = await db
    .select()
    .from(vocabItems)
    .where(and(...conditions))
    .orderBy(sql`${vocabItems.dueAt} asc nulls first`);

  const normalizedQuery = query.toLowerCase();
  return data.map(mapVocabItem).filter((item) => `${item.word} ${item.translation} ${item.contextSentence}`.toLowerCase().includes(normalizedQuery));
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
  const db = getDb();

  if (!db) {
    return;
  }

  await db
    .insert(dictionaryEntries)
    .values({
      word: entry.word,
      phonetic: entry.phonetic,
      translation: entry.translation,
      definition: entry.definition,
      pos: entry.partOfSpeech
    })
    .onConflictDoUpdate({
      target: dictionaryEntries.word,
      set: {
        phonetic: entry.phonetic,
        translation: entry.translation,
        definition: entry.definition,
        pos: entry.partOfSpeech
      }
    });
}

export async function defineWord(word: string, options: DefineWordOptions = {}): Promise<DictionaryEntry | undefined> {
  const normalizedWord = normalizeLookupWord(word);
  const candidates = getLookupCandidates(normalizedWord);
  const db = getDb();
  const fallbackEntry = lookupFallbackDictionary(normalizedWord);

  if (!db) {
    return fallbackEntry ? decorateDictionaryEntry(fallbackEntry, "fallback") : undefined;
  }

  const data = await db
    .select({
      word: dictionaryEntries.word,
      phonetic: dictionaryEntries.phonetic,
      translation: dictionaryEntries.translation,
      definition: dictionaryEntries.definition,
      pos: dictionaryEntries.pos
    })
    .from(dictionaryEntries)
    .where(inArray(dictionaryEntries.word, candidates));

  if (data.length > 0) {
    const row = data.find((item) => item.word === normalizedWord) ?? data[0];

    return decorateDictionaryEntry(
      {
        word: row.word,
        phonetic: row.phonetic ?? "",
        translation: row.translation ?? "",
        definition: row.definition ?? "",
        partOfSpeech: row.pos ?? undefined
      },
      "database"
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
  const db = getDb();

  if (!db) {
    return [];
  }

  const data = await db
    .select({
      id: adminImportJobs.id,
      sourceFilename: adminImportJobs.sourceFilename,
      status: adminImportJobs.status,
      parsedLines: adminImportJobs.parsedLines,
      errorMessage: adminImportJobs.errorMessage,
      createdAt: adminImportJobs.createdAt
    })
    .from(adminImportJobs)
    .orderBy(desc(adminImportJobs.createdAt));

  return data.map(mapAdminImportJob);
}

export async function getProgressData() {
  const user = await getCurrentUser();

  if (!user) {
    return {
      summary: defaultProgressSummary,
      rows: getProgressRows(defaultStudyPlan, {
        completedMinutes: 0,
        completedLines: 0,
        completedRepeats: 0,
        streakDays: 0,
        weeklyLines: 0,
        averageAccuracy: 0,
        totalMinutes: 0
      })
    };
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
