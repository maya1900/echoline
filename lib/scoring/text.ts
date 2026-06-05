import type { RepeatAttempt } from "@/lib/types";

type ScoreInput = {
  targetText: string;
  transcript?: string;
  fallbackTranscript?: boolean;
  fallbackFeedback?: string;
};

function normalizeWords(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}'\s-]/gu, " ")
    .split(/\s+/)
    .map((word) => word.replace(/^'+|'+$/g, ""))
    .filter(Boolean);
}

function levenshteinDistance(left: string[], right: string[]) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  const current = Array.from({ length: right.length + 1 }, () => 0);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    current[0] = leftIndex;

    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitutionCost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      current[rightIndex] = Math.min(
        previous[rightIndex] + 1,
        current[rightIndex - 1] + 1,
        previous[rightIndex - 1] + substitutionCost
      );
    }

    for (let index = 0; index <= right.length; index += 1) {
      previous[index] = current[index];
    }
  }

  return previous[right.length];
}

function getMissedWords(targetWords: string[], transcriptWords: string[]) {
  const remaining = new Map<string, number>();

  for (const word of transcriptWords) {
    remaining.set(word, (remaining.get(word) ?? 0) + 1);
  }

  return targetWords.filter((word) => {
    const count = remaining.get(word) ?? 0;

    if (count > 0) {
      remaining.set(word, count - 1);
      return false;
    }

    return true;
  });
}

function percent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value * 100)));
}

export function scoreRepeatAttempt({ targetText, transcript, fallbackTranscript = false, fallbackFeedback }: ScoreInput): RepeatAttempt {
  const targetWords = normalizeWords(targetText);
  const normalizedTranscript = transcript?.trim() ?? "";
  const transcriptWords = normalizeWords(normalizedTranscript);
  const emptyTranscript = transcriptWords.length === 0;

  if (targetWords.length === 0) {
    const feedback = "目标句为空，无法评分。";

    return {
      transcript: normalizedTranscript,
      accuracy: 0,
      completeness: 0,
      missedWords: [],
      overall: 0,
      feedback,
      scorable: false,
      emptyTranscript,
      reason: feedback
    };
  }

  const distance = levenshteinDistance(targetWords, transcriptWords);
  const missedWords = getMissedWords(targetWords, transcriptWords);
  const accuracy = percent(1 - distance / Math.max(targetWords.length, transcriptWords.length, 1));
  const completeness = percent(1 - missedWords.length / targetWords.length);
  const scorable = !fallbackTranscript && !emptyTranscript;
  const overall = scorable ? Math.round(accuracy * 0.6 + completeness * 0.4) : 0;
  const uniqueMissedWords = Array.from(new Set(missedWords));
  const feedback = !scorable
    ? (fallbackFeedback ?? "未识别到转写，请重新录音。")
    : uniqueMissedWords.length > 0
      ? `再练一次这些词：${uniqueMissedWords.slice(0, 5).join(", ")}。`
      : "内容说全了，可以进入下一句。";

  return {
    transcript: normalizedTranscript,
    accuracy: scorable ? accuracy : 0,
    completeness: scorable ? completeness : 0,
    missedWords: uniqueMissedWords,
    overall,
    feedback,
    scorable,
    emptyTranscript,
    reason: scorable ? undefined : feedback
  };
}
