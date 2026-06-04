import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { defaultUserSettings, getCurrentUserSettings } from "@/lib/user-settings";

function readSubtitleLanguage(value: unknown) {
  return value === "english" || value === "chinese" || value === "both" ? value : undefined;
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export async function GET() {
  const settings = await getCurrentUserSettings();
  return NextResponse.json({ data: settings });
}

export async function PATCH(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
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

  const { data: currentRow } = await supabase.from("profiles").select("asr_api_key").eq("id", user.id).maybeSingle();
  const nextAsrApiKey = typeof body.asrApiKey === "string" ? body.asrApiKey.trim() : "";
  const update: Record<string, unknown> = {
    subtitle_language: readSubtitleLanguage(body.subtitleLanguage) ?? defaultUserSettings.subtitleLanguage,
    default_playback_rate: readNumber(body.defaultPlaybackRate) ?? defaultUserSettings.defaultPlaybackRate,
    auto_loop: typeof body.autoLoop === "boolean" ? body.autoLoop : defaultUserSettings.autoLoop,
    ai_scoring_enabled: typeof body.aiScoringEnabled === "boolean" ? body.aiScoringEnabled : defaultUserSettings.aiScoringEnabled,
    asr_provider: typeof body.asrProvider === "string" && body.asrProvider.trim() ? body.asrProvider.trim() : defaultUserSettings.asrProvider,
    asr_model: typeof body.asrModel === "string" && body.asrModel.trim() ? body.asrModel.trim() : defaultUserSettings.asrModel,
    updated_at: new Date().toISOString()
  };

  if (nextAsrApiKey) {
    update.asr_api_key = nextAsrApiKey;
  } else if (typeof currentRow?.asr_api_key === "string" && currentRow.asr_api_key.trim()) {
    update.asr_api_key = currentRow.asr_api_key;
  }

  const { error } = await supabase.from("profiles").update(update).eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const settings = await getCurrentUserSettings();
  return NextResponse.json({ data: settings });
}
