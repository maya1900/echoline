export type LearningMode = "rough" | "intensive" | "loop" | "repeat" | "call_response";

export type Series = {
  id: string;
  title: string;
  originalTitle: string;
  description: string;
  coverUrl: string;
  difficulty: string;
  genre: string;
  progress: number;
  episodes: Episode[];
};

export type Episode = {
  id: string;
  seriesId: string;
  seasonNumber: number;
  episodeNumber: number;
  title: string;
  description: string;
  durationSeconds: number;
  mediaUrl: string;
  progress: number;
};

export type SubtitleLine = {
  id: string;
  episodeId: string;
  lineIndex: number;
  startMs: number;
  endMs: number;
  englishText: string;
  chineseText: string;
  difficulty: string;
  keywords: string[];
};

export type StudyPlan = {
  dailyMinutes: number;
  dailyLines: number;
  dailyRepeats: number;
  completedMinutes: number;
  completedLines: number;
  completedRepeats: number;
};

export type ProgressSummary = {
  streakDays: number;
  weeklyLines: number;
  averageAccuracy: number;
  totalMinutes: number;
};

export type ProgressRow = {
  id: string;
  label: string;
  value: number;
  target: number;
  tone: "green" | "amber" | "red" | "ink";
};

export type VocabItem = {
  id: string;
  word: string;
  phonetic: string;
  translation: string;
  contextSentence: string;
  status: "new" | "learning" | "mastered";
  reviewCount: number;
  dueAt: string;
};

export type DictionaryEntry = {
  word: string;
  phonetic: string;
  translation: string;
  definition: string;
};

export type RepeatAttempt = {
  transcript: string;
  accuracy: number;
  completeness: number;
  missedWords: string[];
  overall: number;
  feedback: string;
};

export type AdminImportJob = {
  id: string;
  title: string;
  status: "queued" | "processing" | "completed" | "failed";
  result: string;
  createdAt: string;
};
