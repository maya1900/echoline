import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { calculateVocabReviewUpdate, isVocabReviewQuality } from "@/lib/vocab/review";

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

const allowedStatuses = new Set(["new", "learning", "mastered"]);

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

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
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

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  const hasReviewQuality = Object.hasOwn(input, "reviewQuality");
  const reviewQuality = isVocabReviewQuality(input.reviewQuality) ? input.reviewQuality : null;
  let updatePayload: Record<string, unknown> = {};

  if (hasReviewQuality && !reviewQuality) {
    return NextResponse.json({ error: "Invalid reviewQuality" }, { status: 400 });
  }

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

    updatePayload = calculateVocabReviewUpdate(current as VocabRow, reviewQuality);
  } else {
    const manualPayload = readManualUpdatePayload(input);

    if ("error" in manualPayload) {
      return NextResponse.json({ error: manualPayload.error }, { status: 400 });
    }

    updatePayload = manualPayload.data;
  }

  if (Object.keys(updatePayload).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
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

function readManualUpdatePayload(input: Record<string, unknown>) {
  const payload: Record<string, unknown> = {};

  if (Object.hasOwn(input, "translation")) {
    if (typeof input.translation !== "string") {
      return { error: "Invalid translation" };
    }

    payload.translation = input.translation.trim();
  }

  if (Object.hasOwn(input, "note")) {
    if (typeof input.note !== "string" && input.note !== null) {
      return { error: "Invalid note" };
    }

    payload.note = typeof input.note === "string" ? input.note.trim() : null;
  }

  if (Object.hasOwn(input, "status")) {
    if (typeof input.status !== "string" || !allowedStatuses.has(input.status)) {
      return { error: "Invalid status" };
    }

    payload.status = input.status;
  }

  if (Object.hasOwn(input, "reviewCount")) {
    const reviewCount = Number(input.reviewCount);

    if (!Number.isInteger(reviewCount) || reviewCount < 0) {
      return { error: "Invalid reviewCount" };
    }

    payload.review_count = reviewCount;
  }

  if (Object.hasOwn(input, "dueAt")) {
    if (input.dueAt === null || input.dueAt === "") {
      payload.due_at = null;
    } else if (typeof input.dueAt === "string" && !Number.isNaN(new Date(input.dueAt).getTime())) {
      payload.due_at = new Date(input.dueAt).toISOString();
    } else {
      return { error: "Invalid dueAt" };
    }
  }

  return { data: payload };
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
