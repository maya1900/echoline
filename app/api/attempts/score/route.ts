import { NextResponse } from "next/server";
import { scoreRepeatAttempt } from "@/lib/scoring/text";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const allowedModes = new Set(["repeat", "call_response"]);

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

  if (!body.episodeId || !body.subtitleLineId || !body.targetText) {
    return NextResponse.json({ error: "Missing scoring input" }, { status: 400 });
  }

  const mode = typeof body.mode === "string" && allowedModes.has(body.mode) ? body.mode : "repeat";
  const transcript = typeof body.transcript === "string" ? body.transcript : "";
  const fallbackTranscript = transcript.trim().length === 0;
  const attempt = scoreRepeatAttempt({
    targetText: String(body.targetText),
    transcript,
    fallbackTranscript
  });
  const { data, error } = await supabase
    .from("repeat_attempts")
    .insert({
      user_id: user.id,
      episode_id: body.episodeId,
      subtitle_line_id: body.subtitleLineId,
      mode,
      target_text: body.targetText,
      transcript: attempt.transcript,
      audio_url: body.audioUrl ?? null,
      accuracy: attempt.accuracy,
      completeness: attempt.completeness,
      fluency: null,
      overall: attempt.overall,
      feedback: attempt.feedback
    })
    .select("transcript,accuracy,completeness,overall,feedback")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Failed to save repeat attempt" }, { status: 500 });
  }

  return NextResponse.json({
    data: {
      transcript: data.transcript ?? attempt.transcript,
      accuracy: data.accuracy ?? attempt.accuracy,
      completeness: data.completeness ?? attempt.completeness,
      missedWords: attempt.missedWords,
      overall: data.overall ?? attempt.overall,
      feedback: data.feedback ?? attempt.feedback
    }
  });
}
