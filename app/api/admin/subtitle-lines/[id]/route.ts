import { NextResponse } from "next/server";
import { subtitleLines } from "@/lib/mock-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const supabase = await createSupabaseServerClient();

  if (supabase) {
    const { data, error } = await supabase
      .from("subtitle_lines")
      .update({
        english_text: body.englishText,
        chinese_text: body.chineseText,
        start_ms: body.startMs,
        end_ms: body.endMs,
        difficulty: body.difficulty,
        keywords: body.keywords
      })
      .eq("id", id)
      .select("id,episode_id,line_index,start_ms,end_ms,english_text,chinese_text,difficulty,keywords")
      .maybeSingle();

    if (!error && data) {
      return NextResponse.json({ data });
    }
  }

  const line = subtitleLines.find((item) => item.id === id);

  if (!line) {
    return NextResponse.json({ error: "Subtitle line not found" }, { status: 404 });
  }

  return NextResponse.json({ data: { ...line, ...body } });
}
