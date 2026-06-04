import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { UserSettings } from "@/lib/types";

type ProfileSettingsRow = {
  subtitle_language: string | null;
  default_playback_rate: number | null;
  auto_loop: boolean | null;
  ai_scoring_enabled: boolean | null;
  asr_provider?: string | null;
  asr_model?: string | null;
  asr_api_key?: string | null;
};

export const defaultUserSettings: UserSettings = {
  subtitleLanguage: "both",
  defaultPlaybackRate: 1,
  autoLoop: true,
  aiScoringEnabled: true,
  asrProvider: process.env.ASR_PROVIDER ?? "openai",
  asrModel: process.env.ASR_MODEL ?? "gpt-4o-mini-transcribe",
  asrApiKeyConfigured: Boolean(process.env.OPENAI_API_KEY)
};

export function normalizeUserSettings(row: Partial<ProfileSettingsRow> | null | undefined): UserSettings {
  return {
    subtitleLanguage: readSubtitleLanguage(row?.subtitle_language, defaultUserSettings.subtitleLanguage),
    defaultPlaybackRate: readNumber(row?.default_playback_rate, defaultUserSettings.defaultPlaybackRate),
    autoLoop: readBoolean(row?.auto_loop, defaultUserSettings.autoLoop),
    aiScoringEnabled: readBoolean(row?.ai_scoring_enabled, defaultUserSettings.aiScoringEnabled),
    asrProvider: readString(row?.asr_provider, defaultUserSettings.asrProvider),
    asrModel: readString(row?.asr_model, defaultUserSettings.asrModel),
    asrApiKeyConfigured: Boolean(row?.asr_api_key?.trim()) || Boolean(process.env.OPENAI_API_KEY)
  };
}

export async function getCurrentUserSettings(): Promise<UserSettings> {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return defaultUserSettings;
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return defaultUserSettings;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("subtitle_language,default_playback_rate,auto_loop,ai_scoring_enabled,asr_provider,asr_model,asr_api_key")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data) {
    return defaultUserSettings;
  }

  return normalizeUserSettings(data as ProfileSettingsRow);
}

export async function getAsrSettingsForUser(userId: string) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return {
      provider: process.env.ASR_PROVIDER ?? defaultUserSettings.asrProvider,
      model: process.env.ASR_MODEL ?? defaultUserSettings.asrModel,
      apiKey: process.env.OPENAI_API_KEY ?? "",
      enabled: defaultUserSettings.aiScoringEnabled
    };
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("ai_scoring_enabled,asr_provider,asr_model,asr_api_key")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) {
    return {
      provider: process.env.ASR_PROVIDER ?? defaultUserSettings.asrProvider,
      model: process.env.ASR_MODEL ?? defaultUserSettings.asrModel,
      apiKey: process.env.OPENAI_API_KEY ?? "",
      enabled: defaultUserSettings.aiScoringEnabled
    };
  }

  return {
    provider: readString(data.asr_provider, process.env.ASR_PROVIDER ?? defaultUserSettings.asrProvider),
    model: readString(data.asr_model, process.env.ASR_MODEL ?? defaultUserSettings.asrModel),
    apiKey: readString(data.asr_api_key, process.env.OPENAI_API_KEY ?? ""),
    enabled: readBoolean(data.ai_scoring_enabled, defaultUserSettings.aiScoringEnabled)
  };
}

function readString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function readNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function readSubtitleLanguage(value: unknown, fallback: UserSettings["subtitleLanguage"]) {
  return value === "english" || value === "chinese" || value === "both" ? value : fallback;
}
