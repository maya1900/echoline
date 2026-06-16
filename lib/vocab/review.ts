export type VocabReviewQuality = "again" | "good" | "easy";

export type VocabReviewState = {
  review_count: number | null;
  ease: number | string | null;
  interval_days: number | null;
};

export type VocabReviewUpdate = {
  status: "learning" | "mastered";
  review_count: number;
  ease: number;
  interval_days: number;
  due_at: string;
  last_reviewed_at: string;
};

const reviewConfig = {
  minEase: 1.3,
  maxEase: 3.2,
  againPenalty: 0.2,
  easyBonus: 0.15,
  firstGoodIntervalDays: 2,
  easyMinimumIntervalDays: 4,
  masteredIntervalDays: 14,
  masteredReviewCount: 5
};

export function isVocabReviewQuality(value: unknown): value is VocabReviewQuality {
  return value === "again" || value === "good" || value === "easy";
}

export function calculateVocabReviewUpdate(row: VocabReviewState, quality: VocabReviewQuality, reviewedAt = new Date()): VocabReviewUpdate {
  const currentEase = normalizeEase(row.ease);
  const currentInterval = Math.max(0, row.interval_days ?? 0);
  const reviewCount = Math.max(0, row.review_count ?? 0) + 1;
  const reviewedAtIso = reviewedAt.toISOString();

  if (quality === "again") {
    const intervalDays = 1;

    return {
      status: "learning",
      review_count: reviewCount,
      ease: clampEase(currentEase - reviewConfig.againPenalty),
      interval_days: intervalDays,
      due_at: addDays(reviewedAt, intervalDays).toISOString(),
      last_reviewed_at: reviewedAtIso
    };
  }

  const nextEase = quality === "easy" ? clampEase(currentEase + reviewConfig.easyBonus) : clampEase(currentEase);
  const intervalDays = getNextIntervalDays(currentInterval, nextEase, quality);

  return {
    status: intervalDays >= reviewConfig.masteredIntervalDays || reviewCount >= reviewConfig.masteredReviewCount ? "mastered" : "learning",
    review_count: reviewCount,
    ease: nextEase,
    interval_days: intervalDays,
    due_at: addDays(reviewedAt, intervalDays).toISOString(),
    last_reviewed_at: reviewedAtIso
  };
}

function getNextIntervalDays(currentInterval: number, ease: number, quality: Exclude<VocabReviewQuality, "again">) {
  if (quality === "easy") {
    return currentInterval <= 0 ? reviewConfig.easyMinimumIntervalDays : Math.max(reviewConfig.easyMinimumIntervalDays, Math.round(currentInterval * ease));
  }

  if (currentInterval <= 0) {
    return reviewConfig.firstGoodIntervalDays;
  }

  return Math.max(reviewConfig.firstGoodIntervalDays, Math.round(currentInterval * ease));
}

function normalizeEase(value: VocabReviewState["ease"]) {
  const parsed = Number(value ?? 2.5);
  return Number.isFinite(parsed) ? clampEase(parsed) : 2.5;
}

function clampEase(value: number) {
  return Number(Math.min(reviewConfig.maxEase, Math.max(reviewConfig.minEase, value)).toFixed(2));
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}
