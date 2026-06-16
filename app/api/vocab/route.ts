import { NextResponse } from "next/server";
import { requireUserRequest } from "@/lib/auth/api";
import { listVocabItems } from "@/lib/data";
import { vocabItems } from "@/lib/db/schema";

type InsertedVocabRow = typeof vocabItems.$inferSelect;

function readText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

function serializeVocab(row: InsertedVocabRow) {
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

export async function GET(request: Request) {
  const auth = await requireUserRequest();

  if (auth.error) {
    return auth.error;
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const query = searchParams.get("q")?.toLowerCase() ?? "";
  const data = await listVocabItems(status, query);

  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const auth = await requireUserRequest();

  if (auth.error) {
    return auth.error;
  }

  const body = await request.json().catch(() => ({}));

  const word = readText(body.word, 80).toLowerCase();
  const phonetic = readText(body.phonetic, 100);
  const translation = readText(body.translation, 500);
  const contextSentence = readText(body.contextSentence, 600);

  if (!word) {
    return NextResponse.json({ error: "Missing word" }, { status: 400 });
  }

  const now = new Date();

  try {
    const [data] = await auth.db
      .insert(vocabItems)
      .values({
        userId: auth.user.id,
        word,
        phonetic,
        translation,
        contextSentence,
        episodeId: body.episodeId,
        subtitleLineId: body.subtitleLineId,
        dueAt: now,
        updatedAt: now
      })
      .onConflictDoUpdate({
        target: [vocabItems.userId, vocabItems.word],
        set: {
          phonetic,
          translation,
          contextSentence,
          episodeId: body.episodeId,
          subtitleLineId: body.subtitleLineId,
          dueAt: now,
          updatedAt: now
        }
      })
      .returning();

    return NextResponse.json({ data: serializeVocab(data) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to save vocab item" }, { status: 500 });
  }
}
