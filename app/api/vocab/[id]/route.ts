import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type VocabRow = {
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

type ReviewQuality = "again" | "good" | "easy";

function serializeVocab(row: VocabRow) {
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

function isReviewQuality(value: unknown): value is ReviewQuality {
  return value === "again" || value === "good" || value === "easy";
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function calculateReviewUpdate(row: VocabRow, quality: ReviewQuality) {
  const now = new Date();
  const currentEase = Number(row.ease ?? 2.5);
  const currentInterval = row.interval_days ?? 0;
  const reviewCount = row.review_count + 1;

  if (quality === "again") {
    return {
      status: "learning",
      review_count: reviewCount,
      ease: Math.max(1.3, Number((currentEase - 0.2).toFixed(2))),
      interval_days: 1,
      due_at: addDays(now, 1).toISOString(),
      last_reviewed_at: now.toISOString()
    };
  }

  const easeDelta = quality === "easy" ? 0.15 : 0;
  const nextEase = Math.min(3.2, Number((currentEase + easeDelta).toFixed(2)));
  const nextInterval =
    quality === "easy"
      ? Math.max(4, Math.round(Math.max(1, currentInterval) * nextEase))
      : currentInterval <= 0
        ? 2
        : Math.max(2, Math.round(currentInterval * nextEase));

  return {
    status: nextInterval >= 7 || reviewCount >= 4 ? "mastered" : "learning",
    review_count: reviewCount,
    ease: nextEase,
    interval_days: nextInterval,
    due_at: addDays(now, nextInterval).toISOString(),
    last_reviewed_at: now.toISOString()
  };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const reviewQuality = isReviewQuality(body.reviewQuality) ? body.reviewQuality : null;
  let updatePayload: Record<string, unknown> = {
    translation: body.translation,
    note: body.note,
    status: body.status,
    review_count: body.reviewCount,
    due_at: body.dueAt
  };

  if (reviewQuality) {
    const { data: current, error: readError } = await supabase
      .from("vocab_items")
      .select("id,word,phonetic,translation,context_sentence,status,review_count,ease,interval_days,due_at,last_reviewed_at")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (readError) {
      return NextResponse.json({ error: readError.message }, { status: 500 });
    }

    if (!current) {
      return NextResponse.json({ error: "Vocab item not found" }, { status: 404 });
    }

    updatePayload = calculateReviewUpdate(current as VocabRow, reviewQuality);
  }

  const { data, error } = await supabase
    .from("vocab_items")
    .update(updatePayload)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id,word,phonetic,translation,context_sentence,status,review_count,ease,interval_days,due_at,last_reviewed_at")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Vocab item not found" }, { status: 404 });
  }

  return NextResponse.json({ data: serializeVocab(data as VocabRow) });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabase.from("vocab_items").delete().eq("id", id).eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: { id, deleted: true } });
}
