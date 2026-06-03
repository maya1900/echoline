import type { AdminImportJob, DictionaryEntry, Episode, ProgressRow, ProgressSummary, RepeatAttempt, Series, StudyPlan, SubtitleLine, VocabItem } from "./types";

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

export const series: Series[] = [
  {
    id: "rain-alley",
    title: "雨巷公寓",
    originalTitle: "Rain Alley",
    description: "一群新搬进伦敦老公寓的年轻人，在厨房、楼梯间和深夜便利店里练习把话说清楚。",
    coverUrl: "https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=1200&q=80",
    difficulty: "B1",
    genre: "生活 / 情景",
    progress: 42,
    episodes: [
      {
        id: "episode-1",
        seriesId: "rain-alley",
        seasonNumber: 1,
        episodeNumber: 1,
        title: "The Spare Key",
        description: "Maya 找不到备用钥匙，只好向刚认识的邻居开口求助。",
        durationSeconds: 1320,
        mediaUrl: "/mock/rain-alley-episode-1.mp4",
        progress: 58
      },
      {
        id: "episode-2",
        seriesId: "rain-alley",
        seasonNumber: 1,
        episodeNumber: 2,
        title: "Too Much Pepper",
        description: "一锅过辣的汤让所有人开始交换道歉和补救方式。",
        durationSeconds: 1410,
        mediaUrl: "/mock/rain-alley-episode-2.mp4",
        progress: 12
      }
    ]
  },
  {
    id: "station-nine",
    title: "九号站台",
    originalTitle: "Station Nine",
    description: "通勤路上的短对话，适合练习请求、确认、解释和轻松寒暄。",
    coverUrl: "https://images.unsplash.com/photo-1517586979036-b7d1e86b3345?auto=format&fit=crop&w=1200&q=80",
    difficulty: "A2",
    genre: "通勤 / 日常",
    progress: 18,
    episodes: [
      {
        id: "episode-3",
        seriesId: "station-nine",
        seasonNumber: 1,
        episodeNumber: 1,
        title: "Mind the Gap",
        description: "延误通知之后，三位陌生人开始拼一条备用路线。",
        durationSeconds: 1080,
        mediaUrl: "/mock/station-nine-episode-1.mp4",
        progress: 18
      }
    ]
  }
];

export const subtitleLines: SubtitleLine[] = [
  {
    id: "line-1",
    episodeId: "episode-1",
    lineIndex: 1,
    startMs: 12200,
    endMs: 15400,
    englishText: "I thought the spare key was under the blue flowerpot.",
    chineseText: "我以为备用钥匙在蓝色花盆下面。",
    difficulty: "B1",
    keywords: ["thought", "spare", "flowerpot"]
  },
  {
    id: "line-2",
    episodeId: "episode-1",
    lineIndex: 2,
    startMs: 15800,
    endMs: 18900,
    englishText: "It was, until your cat decided to redecorate the hallway.",
    chineseText: "本来是在那儿，直到你的猫决定重新布置走廊。",
    difficulty: "B1",
    keywords: ["until", "decided", "redecorate"]
  },
  {
    id: "line-3",
    episodeId: "episode-1",
    lineIndex: 3,
    startMs: 19600,
    endMs: 22500,
    englishText: "Could you lend me your phone for a minute?",
    chineseText: "你能把手机借我一分钟吗？",
    difficulty: "A2",
    keywords: ["lend", "minute"]
  },
  {
    id: "line-4",
    episodeId: "episode-1",
    lineIndex: 4,
    startMs: 23100,
    endMs: 26300,
    englishText: "Sure, but promise you will not call the landlord before coffee.",
    chineseText: "当然，但答应我喝咖啡前别给房东打电话。",
    difficulty: "B1",
    keywords: ["promise", "landlord"]
  },
  {
    id: "line-5",
    episodeId: "episode-1",
    lineIndex: 5,
    startMs: 27100,
    endMs: 30400,
    englishText: "Deal. I make terrible decisions without breakfast.",
    chineseText: "成交。我没吃早饭时总会做糟糕决定。",
    difficulty: "B1",
    keywords: ["deal", "terrible", "decisions"]
  }
];

export const extraSubtitleLines: SubtitleLine[] = [
  {
    id: "line-6",
    episodeId: "episode-2",
    lineIndex: 1,
    startMs: 8400,
    endMs: 11200,
    englishText: "Did anyone check how much pepper was in that jar?",
    chineseText: "有人看过那个罐子里到底有多少胡椒吗？",
    difficulty: "A2",
    keywords: ["check", "pepper", "jar"]
  },
  {
    id: "line-7",
    episodeId: "episode-2",
    lineIndex: 2,
    startMs: 11800,
    endMs: 15100,
    englishText: "I only added a little, but the spoon had other plans.",
    chineseText: "我只加了一点点，但那把勺子显然另有打算。",
    difficulty: "B1",
    keywords: ["added", "little", "plans"]
  },
  {
    id: "line-8",
    episodeId: "episode-3",
    lineIndex: 1,
    startMs: 6200,
    endMs: 9300,
    englishText: "The next train is delayed by twelve minutes.",
    chineseText: "下一班车晚点十二分钟。",
    difficulty: "A2",
    keywords: ["train", "delayed", "minutes"]
  },
  {
    id: "line-9",
    episodeId: "episode-3",
    lineIndex: 2,
    startMs: 9800,
    endMs: 12800,
    englishText: "We can take the bus if we leave now.",
    chineseText: "如果现在走，我们可以坐公交。",
    difficulty: "A2",
    keywords: ["bus", "leave", "now"]
  }
];

subtitleLines.push(...extraSubtitleLines);

export const vocabItems: VocabItem[] = [
  {
    id: "vocab-1",
    word: "spare",
    phonetic: "/sper/",
    translation: "备用的；多余的",
    contextSentence: "I thought the spare key was under the blue flowerpot.",
    status: "learning",
    reviewCount: 3,
    dueAt: "今天"
  },
  {
    id: "vocab-2",
    word: "landlord",
    phonetic: "/ˈlændlɔːrd/",
    translation: "房东",
    contextSentence: "You will not call the landlord before coffee.",
    status: "new",
    reviewCount: 0,
    dueAt: "今天"
  },
  {
    id: "vocab-3",
    word: "redecorate",
    phonetic: "/ˌriːˈdekəreɪt/",
    translation: "重新装饰；重新布置",
    contextSentence: "Your cat decided to redecorate the hallway.",
    status: "mastered",
    reviewCount: 6,
    dueAt: "6 月 10 日"
  }
];

export const dictionary = new Map<string, DictionaryEntry>(
  [
    ...vocabItems,
    {
      id: "dict-1",
      word: "pepper",
      phonetic: "/ˈpepər/",
      translation: "胡椒；辣椒粉",
      contextSentence: "Did anyone check how much pepper was in that jar.",
      status: "new" as const,
      reviewCount: 0,
      dueAt: "今天"
    },
    {
      id: "dict-2",
      word: "delayed",
      phonetic: "/dɪˈleɪd/",
      translation: "延迟的；晚点的",
      contextSentence: "The next train is delayed by twelve minutes.",
      status: "new" as const,
      reviewCount: 0,
      dueAt: "明天"
    }
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
    id: "job-1",
    title: "Rain Alley S01E01 字幕导入",
    status: "completed",
    result: "解析 5 行字幕，已绑定到 The Spare Key。",
    createdAt: "今天 14:20"
  },
  {
    id: "job-2",
    title: "Station Nine 媒体检查",
    status: "processing",
    result: "等待生成私有媒体签名 URL。",
    createdAt: "今天 15:05"
  }
];

export const mockAttempt: RepeatAttempt = {
  transcript: "I thought the spare key was under blue flowerpot.",
  accuracy: 86,
  completeness: 82,
  missedWords: ["the"],
  overall: 84,
  feedback: "整体说对了，注意不要漏掉第二个 the，再慢速跟一遍会更稳。"
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
