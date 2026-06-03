import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const supabase = await createSupabaseServerClient();

  if (supabase) {
    const { data, error } = await supabase
      .from("episodes")
      .insert({
        series_id: body.seriesId,
        season_number: body.seasonNumber ?? 1,
        episode_number: body.episodeNumber,
        title: body.title,
        description: body.description,
        media_url: body.mediaUrl,
        duration_seconds: body.durationSeconds,
        status: body.status ?? "draft"
      })
      .select("id,series_id,season_number,episode_number,title,description,media_url,duration_seconds,status")
      .single();

    if (!error && data) {
      return NextResponse.json({ data }, { status: 201 });
    }
  }

  return NextResponse.json({ data: { id: `episode-${Date.now()}`, progress: 0, ...body } }, { status: 201 });
}
