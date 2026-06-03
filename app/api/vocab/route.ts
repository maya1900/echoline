import { NextResponse } from "next/server";
import { listVocabItems } from "@/lib/data";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type VocabRow = {
  id: string;
  word: string;
  phonetic: string | null;
  translation: string | null;
  context_sentence: string | null;
  status: "new" | "learning" | "mastered";
  review_count: number;
  due_at: string | null;
};

function serializeVocab(row: VocabRow) {
  return {
    id: row.id,
    word: row.word,
    phonetic: row.phonetic ?? "",
    translation: row.translation ?? "",
    contextSentence: row.context_sentence ?? "",
    status: row.status,
    reviewCount: row.review_count,
    dueAt: row.due_at ?? "今天"
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const query = searchParams.get("q")?.toLowerCase() ?? "";
  const data = await listVocabItems(status, query);

  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const supabase = await createSupabaseServerClient();

  if (supabase) {
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (user) {
      const { data, error } = await supabase
        .from("vocab_items")
        .upsert({
          user_id: user.id,
          word: body.word,
          phonetic: body.phonetic ?? "",
          translation: body.translation ?? "",
          context_sentence: body.contextSentence ?? "",
          episode_id: body.episodeId,
          subtitle_line_id: body.subtitleLineId,
          due_at: new Date().toISOString()
        })
        .select("id,word,phonetic,translation,context_sentence,status,review_count,due_at")
        .single();

      if (!error && data) {
        return NextResponse.json({ data: serializeVocab(data as VocabRow) }, { status: 201 });
      }
    }
  }

  return NextResponse.json(
    {
      data: {
        id: `vocab-${Date.now()}`,
        status: "new",
        reviewCount: 0,
        dueAt: "今天",
        ...body
      }
    },
    { status: 201 }
  );
}
