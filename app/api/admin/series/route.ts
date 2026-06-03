import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const supabase = await createSupabaseServerClient();

  if (supabase) {
    const { data, error } = await supabase
      .from("series")
      .insert({
        title: body.title,
        original_title: body.originalTitle,
        description: body.description,
        cover_url: body.coverUrl,
        difficulty: body.difficulty ?? "B1",
        genre: body.genre,
        status: body.status ?? "draft"
      })
      .select("id,title,original_title,description,cover_url,difficulty,genre,status")
      .single();

    if (!error && data) {
      return NextResponse.json({ data }, { status: 201 });
    }
  }

  return NextResponse.json({ data: { id: `series-${Date.now()}`, ...body } }, { status: 201 });
}
