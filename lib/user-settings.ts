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
  asrProvider: readAsrProvider(process.env.ASR_PROVIDER),
  asrModel: process.env.ASR_MODEL ?? defaultAsrModel(readAsrProvider(process.env.ASR_PROVIDER)),
  asrApiKeyConfigured: Boolean(readAsrEnvironmentApiKey(readAsrProvider(process.env.ASR_PROVIDER)))
};

export function normalizeUserSettings(row: Partial<ProfileSettingsRow> | null | undefined): UserSettings {
  const asrProvider = readAsrProvider(row?.asr_provider);

  return {
    subtitleLanguage: readSubtitleLanguage(row?.subtitle_language, defaultUserSettings.subtitleLanguage),
    defaultPlaybackRate: readNumber(row?.default_playback_rate, defaultUserSettings.defaultPlaybackRate),
    autoLoop: readBoolean(row?.auto_loop, defaultUserSettings.autoLoop),
    aiScoringEnabled: readBoolean(row?.ai_scoring_enabled, defaultUserSettings.aiScoringEnabled),
    asrProvider,
    asrModel: readString(row?.asr_model, defaultAsrModel(asrProvider)),
    asrApiKeyConfigured: Boolean(row?.asr_api_key?.trim()) || Boolean(readAsrEnvironmentApiKey(asrProvider))
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
      provider: defaultUserSettings.asrProvider,
      model: process.env.ASR_MODEL ?? defaultAsrModel(defaultUserSettings.asrProvider),
      apiKey: readAsrEnvironmentApiKey(defaultUserSettings.asrProvider),
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
      provider: defaultUserSettings.asrProvider,
      model: process.env.ASR_MODEL ?? defaultAsrModel(defaultUserSettings.asrProvider),
      apiKey: readAsrEnvironmentApiKey(defaultUserSettings.asrProvider),
      enabled: defaultUserSettings.aiScoringEnabled
    };
  }

  const provider = readAsrProvider(data.asr_provider);

  return {
    provider,
    model: readString(data.asr_model, process.env.ASR_MODEL ?? defaultAsrModel(provider)),
    apiKey: readString(data.asr_api_key, readAsrEnvironmentApiKey(provider)),
    enabled: readBoolean(data.ai_scoring_enabled, defaultUserSettings.aiScoringEnabled)
  };
}

export function defaultAsrModel(provider: string) {
  return provider === "zhipu" ? "glm-asr-2512" : "gpt-4o-mini-transcribe";
}

export function readAsrEnvironmentApiKey(provider: string) {
  if (provider === "zhipu") {
    return process.env.ZHIPU_API_KEY ?? process.env.BIGMODEL_API_KEY ?? "";
  }

  return process.env.OPENAI_API_KEY ?? "";
}

function readAsrProvider(value: unknown) {
  return value === "zhipu" ? "zhipu" : "openai";
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
