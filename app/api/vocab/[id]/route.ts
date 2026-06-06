import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireUserRequest } from "@/lib/auth/api";
import { vocabItems } from "@/lib/db/schema";
import { calculateVocabReviewUpdate, isVocabReviewQuality } from "@/lib/vocab/review";

type VocabRow = typeof vocabItems.$inferSelect;

const allowedStatuses = new Set(["new", "learning", "mastered"]);

function serializeVocab(row: VocabRow) {
  const dueDate = row.dueAt ? new Date(row.dueAt) : null;

  return {
    id: row.id,
    word: row.word,
    phonetic: row.phonetic ?? "",
    translation: row.translation ?? "",
    contextSentence: row.contextSentence ?? "",
    status: row.status as "new" | "learning" | "mastered",
    reviewCount: row.reviewCount,
    dueAt: dueDate ? new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric" }).format(dueDate) : "今天",
    dueAtIso: row.dueAt ? row.dueAt.toISOString() : null,
    isDue: !dueDate || dueDate.getTime() <= Date.now(),
    ease: Number(row.ease ?? 2.5),
    intervalDays: row.intervalDays ?? 0,
    lastReviewedAt: row.lastReviewedAt ? row.lastReviewedAt.toISOString() : null
  };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const auth = await requireUserRequest();

  if (auth.error) {
    return auth.error;
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  const hasReviewQuality = Object.hasOwn(input, "reviewQuality");
  const reviewQuality = isVocabReviewQuality(input.reviewQuality) ? input.reviewQuality : null;
  let updatePayload: Partial<typeof vocabItems.$inferInsert> = {};

  if (hasReviewQuality && !reviewQuality) {
    return NextResponse.json({ error: "Invalid reviewQuality" }, { status: 400 });
  }

  if (reviewQuality) {
    const [current] = await auth.db
      .select()
      .from(vocabItems)
      .where(and(eq(vocabItems.id, id), eq(vocabItems.userId, auth.user.id)))
      .limit(1);

    if (!current) {
      return NextResponse.json({ error: "Vocab item not found" }, { status: 404 });
    }

    const update = calculateVocabReviewUpdate(
      {
        review_count: current.reviewCount,
        ease: current.ease,
        interval_days: current.intervalDays
      },
      reviewQuality
    );

    updatePayload = {
      status: update.status,
      reviewCount: update.review_count,
      ease: String(update.ease),
      intervalDays: update.interval_days,
      dueAt: new Date(update.due_at),
      lastReviewedAt: new Date(update.last_reviewed_at),
      updatedAt: new Date()
    };
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

  const [data] = await auth.db
    .update(vocabItems)
    .set(updatePayload)
    .where(and(eq(vocabItems.id, id), eq(vocabItems.userId, auth.user.id)))
    .returning();

  if (!data) {
    return NextResponse.json({ error: "Vocab item not found" }, { status: 404 });
  }

  return NextResponse.json({ data: serializeVocab(data) });
}

function readManualUpdatePayload(input: Record<string, unknown>) {
  const payload: Partial<typeof vocabItems.$inferInsert> = { updatedAt: new Date() };

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

    payload.reviewCount = reviewCount;
  }

  if (Object.hasOwn(input, "dueAt")) {
    if (input.dueAt === null || input.dueAt === "") {
      payload.dueAt = null;
    } else if (typeof input.dueAt === "string" && !Number.isNaN(new Date(input.dueAt).getTime())) {
      payload.dueAt = new Date(input.dueAt);
    } else {
      return { error: "Invalid dueAt" };
    }
  }

  return { data: payload };
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireUserRequest();

  if (auth.error) {
    return auth.error;
  }

  await auth.db.delete(vocabItems).where(and(eq(vocabItems.id, id), eq(vocabItems.userId, auth.user.id)));

  return NextResponse.json({ data: { id, deleted: true } });
}
