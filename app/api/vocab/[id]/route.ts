import { NextResponse } from "next/server";
import { vocabItems } from "@/lib/mock-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const supabase = await createSupabaseServerClient();

  if (supabase) {
    const { data, error } = await supabase
      .from("vocab_items")
      .update({
        translation: body.translation,
        note: body.note,
        status: body.status,
        review_count: body.reviewCount,
        due_at: body.dueAt
      })
      .eq("id", id)
      .select("id,word,phonetic,translation,context_sentence,status,review_count,due_at")
      .maybeSingle();

    if (!error && data) {
      return NextResponse.json({ data });
    }
  }

  const item = vocabItems.find((entry) => entry.id === id);

  if (!item) {
    return NextResponse.json({ error: "Vocab item not found" }, { status: 404 });
  }

  return NextResponse.json({ data: { ...item, ...body } });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  if (supabase) {
    await supabase.from("vocab_items").delete().eq("id", id);
  }

  return NextResponse.json({ data: { id, deleted: true } });
}
