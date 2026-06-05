import fs from "node:fs";
import path from "node:path";
import { parseSubtitleText } from "./subtitles/parser";
import type { AdminImportJob, DictionaryEntry, Episode, ProgressRow, ProgressSummary, RepeatAttempt, Series, StudyPlan, SubtitleLine, VocabItem } from "./types";

const localMockRoot = path.join(process.cwd(), "mock");
const campusMockDir = "校园之外第一季_第1集_mp4";

function getLocalMockEpisodes(): { episodes: Episode[]; lines: SubtitleLine[] } {
  const directory = path.join(localMockRoot, campusMockDir);

  if (!fs.existsSync(directory)) {
    return { episodes: [], lines: [] };
  }

  const stems = fs
    .readdirSync(directory)
    .filter((filename) => filename.endsWith(".mp4"))
    .map((filename) => filename.replace(/\.mp4$/, ""))
    .sort((left, right) => left.localeCompare(right, "zh-CN"));

  return stems.reduce(
    (result, stem, index) => {
      const part = stem.match(/_(\d+)$/)?.[1] ?? String(index).padStart(2, "0");
      const episodeId = `campus-beyond-s1e1-${part}`;
      const subtitlePath = path.join(directory, `${stem}.srt`);
      const parsedLines = fs.existsSync(subtitlePath) ? parseSubtitleText(fs.readFileSync(subtitlePath, "utf8")) : [];
      const durationSeconds = Math.max(Math.ceil((parsedLines.at(-1)?.endMs ?? 5 * 60 * 1000) / 1000), 1);

      result.episodes.push({
        id: episodeId,
        seriesId: "campus-beyond",
        seasonNumber: 1,
        episodeNumber: index + 1,
        title: `第 1 集 · 片段 ${part}`,
        description: "校园生活短片段，适合做精听、逐句循环和跟读练习。",
        durationSeconds,
        mediaUrl: `/api/mock-media/${encodeURIComponent(campusMockDir)}/${encodeURIComponent(`${stem}.mp4`)}`,
        progress: index === 0 ? 34 : 0
      });

      result.lines.push(
        ...parsedLines.map((line) => ({
          id: `${episodeId}-line-${line.lineIndex}`,
          episodeId,
          lineIndex: line.lineIndex,
          startMs: line.startMs,
          endMs: line.endMs,
          englishText: line.englishText,
          chineseText: line.chineseText,
          difficulty: "B1",
          keywords: line.keywords
        }))
      );

      return result;
    },
    { episodes: [] as Episode[], lines: [] as SubtitleLine[] }
  );
}

const localMock = getLocalMockEpisodes();

export const studyPlan: StudyPlan = {
  dailyMinutes: 25,
  dailyLines: 18,
  dailyRepeats: 8,
  completedMinutes: 16,
  completedLines: 11,
  completedRepeats: 4
};

export const progressSummary: ProgressSummary = {
  streakDays: 9,
  weeklyLines: 73,
  averageAccuracy: 86,
  totalMinutes: 420
};

export const progressRows: ProgressRow[] = [
  { id: "minutes", label: "今日分钟", value: studyPlan.completedMinutes, target: studyPlan.dailyMinutes, tone: "green" },
  { id: "lines", label: "今日句子", value: studyPlan.completedLines, target: studyPlan.dailyLines, tone: "amber" },
  { id: "repeats", label: "今日跟读", value: studyPlan.completedRepeats, target: studyPlan.dailyRepeats, tone: "ink" },
  { id: "accuracy", label: "内容正确率", value: progressSummary.averageAccuracy, target: 90, tone: "red" }
];

export const series: Series[] =
  localMock.episodes.length > 0
    ? [
        {
          id: "campus-beyond",
          title: "校园之外",
          originalTitle: "Beyond Campus",
          description: "一组围绕课堂、宿舍和乐队排练展开的校园对话片段，适合用真实字幕反复练习。",
          coverUrl: "https://images.unsplash.com/photo-1523580494863-6f3031224c94?auto=format&fit=crop&w=1200&q=80",
          difficulty: "B1",
          genre: "校园 / 日常",
          progress: 12,
          episodes: localMock.episodes
        }
      ]
    : [];

export const subtitleLines: SubtitleLine[] = localMock.lines;

function makeVocabItem(item: Omit<VocabItem, "dueAtIso" | "isDue" | "ease" | "intervalDays" | "lastReviewedAt"> & Partial<Pick<VocabItem, "dueAtIso" | "isDue" | "ease" | "intervalDays" | "lastReviewedAt">>): VocabItem {
  return {
    dueAtIso: null,
    isDue: item.dueAt === "今天",
    ease: 2.5,
    intervalDays: item.status === "mastered" ? 7 : item.reviewCount > 0 ? 1 : 0,
    lastReviewedAt: null,
    ...item
  };
}

export const vocabItems: VocabItem[] = [
  makeVocabItem({
    id: "vocab-average",
    word: "average",
    phonetic: "/ˈævərɪdʒ/",
    translation: "平均的；普通的",
    contextSentence: "In my class, average actually means average.",
    status: "learning",
    reviewCount: 2,
    dueAt: "今天"
  }),
  makeVocabItem({
    id: "vocab-major",
    word: "major",
    phonetic: "/ˈmeɪdʒər/",
    translation: "专业；主修",
    contextSentence: "I need this for my major.",
    status: "new",
    reviewCount: 0,
    dueAt: "今天"
  }),
  makeVocabItem({
    id: "vocab-respect",
    word: "respect",
    phonetic: "/rɪˈspekt/",
    translation: "尊重；敬重",
    contextSentence: "He is a talented musician who I respect.",
    status: "mastered",
    reviewCount: 5,
    dueAt: "6 月 10 日"
  })
];

export const dictionary = new Map<string, DictionaryEntry>(
  [
    ...vocabItems,
    makeVocabItem({
      id: "dict-right",
      word: "right",
      phonetic: "/raɪt/",
      translation: "正确的；右边；立刻；好吧",
      contextSentence: "We'll be right back.",
      status: "new" as const,
      reviewCount: 0,
      dueAt: "今天"
    }),
    makeVocabItem({
      id: "dict-back",
      word: "back",
      phonetic: "/bæk/",
      translation: "回来；后面；背部",
      contextSentence: "We'll be right back.",
      status: "new" as const,
      reviewCount: 0,
      dueAt: "今天"
    }),
    makeVocabItem({
      id: "dict-sure",
      word: "sure",
      phonetic: "/ʃʊr/",
      translation: "确信的；当然",
      contextSentence: "I'm sure of that.",
      status: "new" as const,
      reviewCount: 0,
      dueAt: "今天"
    }),
    makeVocabItem({
      id: "dict-looking",
      word: "looking",
      phonetic: "/ˈlʊkɪŋ/",
      translation: "正在看；寻找",
      contextSentence: "You looking for someone?",
      status: "new" as const,
      reviewCount: 0,
      dueAt: "今天"
    }),
    makeVocabItem({
      id: "dict-someone",
      word: "someone",
      phonetic: "/ˈsʌmwʌn/",
      translation: "某人；有人",
      contextSentence: "You looking for someone?",
      status: "new" as const,
      reviewCount: 0,
      dueAt: "今天"
    }),
    makeVocabItem({
      id: "dict-relax",
      word: "relax",
      phonetic: "/rɪˈlæks/",
      translation: "放松；别紧张",
      contextSentence: "Relax.",
      status: "new" as const,
      reviewCount: 0,
      dueAt: "今天"
    }),
    makeVocabItem({
      id: "dict-musician",
      word: "musician",
      phonetic: "/mjuːˈzɪʃən/",
      translation: "音乐人；乐手",
      contextSentence: "He is a talented musician who I respect.",
      status: "new" as const,
      reviewCount: 0,
      dueAt: "明天"
    }),
    makeVocabItem({
      id: "dict-girlfriend",
      word: "girlfriend",
      phonetic: "/ˈɡɜːrlfrend/",
      translation: "女朋友",
      contextSentence: "She's not my girlfriend.",
      status: "new" as const,
      reviewCount: 0,
      dueAt: "明天"
    })
  ].map((item) => [
    item.word,
    {
      word: item.word,
      phonetic: item.phonetic,
      translation: item.translation,
      definition: item.contextSentence
    }
  ])
);

export const adminImportJobs: AdminImportJob[] = [
  {
    id: "job-campus-beyond",
    title: "校园之外 S01E01 字幕导入",
    status: "completed",
    result: `解析 ${subtitleLines.length} 行字幕，已绑定到 10 个学习片段。`,
    createdAt: "今天 15:30"
  }
];

export const mockAttempt: RepeatAttempt = {
  transcript: "In my class average actually means average.",
  accuracy: 92,
  completeness: 90,
  missedWords: ["class"],
  overall: 91,
  feedback: "整体内容很准，注意 class 的收尾音，再慢速跟一遍会更稳。"
};

export function getEpisode(id: string): Episode | undefined {
  return series.flatMap((item) => item.episodes).find((episode) => episode.id === id);
}

export function getSeriesForEpisode(episodeId: string): Series | undefined {
  return series.find((item) => item.episodes.some((episode) => episode.id === episodeId));
}

export function getSubtitlesForEpisode(episodeId: string) {
  return subtitleLines.filter((line) => line.episodeId === episodeId);
}
