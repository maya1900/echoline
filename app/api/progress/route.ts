import { NextResponse } from "next/server";
import { getProgressData } from "@/lib/data";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const { rows: progressRows, summary: progressSummary } = await getProgressData();
  return NextResponse.json({ data: { summary: progressSummary, rows: progressRows } });
}

export async function POST(request: Request) {
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

  if (!body.episodeId || !body.subtitleLineId || !body.mode) {
    return NextResponse.json({ error: "Missing progress input" }, { status: 400 });
  }

  const { error } = await supabase.from("learning_progress").upsert(
    {
      user_id: user.id,
      series_id: body.seriesId,
      episode_id: body.episodeId,
      subtitle_line_id: body.subtitleLineId,
      mode: body.mode,
      playback_position_ms: body.playbackPositionMs ?? 0,
      completed: body.completed ?? false,
      repeat_count: body.repeatCount ?? 0,
      best_score: body.bestScore,
      last_studied_at: new Date().toISOString()
    },
    {
      onConflict: "user_id,episode_id,subtitle_line_id,mode"
    }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: { ...body, saved: true } });
}
