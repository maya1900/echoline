import { NextResponse } from "next/server";
import { mockAttempt } from "@/lib/mock-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const supabase = await createSupabaseServerClient();

  if (supabase) {
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (user && body.episodeId && body.subtitleLineId && body.targetText) {
      await supabase.from("repeat_attempts").insert({
        user_id: user.id,
        episode_id: body.episodeId,
        subtitle_line_id: body.subtitleLineId,
        mode: body.mode ?? "repeat",
        target_text: body.targetText,
        transcript: mockAttempt.transcript,
        audio_url: body.audioUrl,
        accuracy: mockAttempt.accuracy,
        completeness: mockAttempt.completeness,
        fluency: null,
        overall: mockAttempt.overall,
        feedback: mockAttempt.feedback
      });
    }
  }

  return NextResponse.json({
    data: {
      ...mockAttempt,
      mode: body.mode ?? "repeat",
      episodeId: body.episodeId,
      subtitleLineId: body.subtitleLineId
    }
  });
}
