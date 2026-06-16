import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/bootstrap";
import { getDb } from "@/lib/db/client";
import { profiles } from "@/lib/db/schema";
import { hasStoredSecretValue, openSecretValue } from "@/lib/secret-values";
import type { UserSettings } from "@/lib/types";

type ProfileSettingsRow = {
  subtitleLanguage: string | null;
  defaultPlaybackRate: string | number | null;
  autoLoop: boolean | null;
  aiScoringEnabled: boolean | null;
  asrProvider?: string | null;
  asrModel?: string | null;
  asrApiKey?: string | null;
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
  const asrProvider = readAsrProvider(row?.asrProvider);

  return {
    subtitleLanguage: readSubtitleLanguage(row?.subtitleLanguage, defaultUserSettings.subtitleLanguage),
    defaultPlaybackRate: readNumber(row?.defaultPlaybackRate, defaultUserSettings.defaultPlaybackRate),
    autoLoop: readBoolean(row?.autoLoop, defaultUserSettings.autoLoop),
    aiScoringEnabled: readBoolean(row?.aiScoringEnabled, defaultUserSettings.aiScoringEnabled),
    asrProvider,
    asrModel: readString(row?.asrModel, defaultAsrModel(asrProvider)),
    asrApiKeyConfigured: hasStoredSecretValue(row?.asrApiKey) || Boolean(readAsrEnvironmentApiKey(asrProvider))
  };
}

export async function getCurrentUserSettings(): Promise<UserSettings> {
  const db = getDb();
  const user = await getCurrentUser();

  if (!db || !user) {
    return defaultUserSettings;
  }

  const [data] = await db
    .select({
      subtitleLanguage: profiles.subtitleLanguage,
      defaultPlaybackRate: profiles.defaultPlaybackRate,
      autoLoop: profiles.autoLoop,
      aiScoringEnabled: profiles.aiScoringEnabled,
      asrProvider: profiles.asrProvider,
      asrModel: profiles.asrModel,
      asrApiKey: profiles.asrApiKey
    })
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .limit(1);

  return normalizeUserSettings(data);
}

export async function getAsrSettingsForUser(userId: string) {
  const db = getDb();

  if (!db) {
    return {
      provider: defaultUserSettings.asrProvider,
      model: process.env.ASR_MODEL ?? defaultAsrModel(defaultUserSettings.asrProvider),
      apiKey: readAsrEnvironmentApiKey(defaultUserSettings.asrProvider),
      enabled: defaultUserSettings.aiScoringEnabled
    };
  }

  const [data] = await db
    .select({
      aiScoringEnabled: profiles.aiScoringEnabled,
      asrProvider: profiles.asrProvider,
      asrModel: profiles.asrModel,
      asrApiKey: profiles.asrApiKey
    })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);

  if (!data) {
    return {
      provider: defaultUserSettings.asrProvider,
      model: process.env.ASR_MODEL ?? defaultAsrModel(defaultUserSettings.asrProvider),
      apiKey: readAsrEnvironmentApiKey(defaultUserSettings.asrProvider),
      enabled: defaultUserSettings.aiScoringEnabled
    };
  }

  const provider = readAsrProvider(data.asrProvider);

  return {
    provider,
    model: readString(data.asrModel, process.env.ASR_MODEL ?? defaultAsrModel(provider)),
    apiKey: readString(openSecretValue(data.asrApiKey), readAsrEnvironmentApiKey(provider)),
    enabled: readBoolean(data.aiScoringEnabled, defaultUserSettings.aiScoringEnabled)
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
  const numberValue = typeof value === "string" ? Number(value) : value;
  return typeof numberValue === "number" && Number.isFinite(numberValue) ? numberValue : fallback;
}

function readBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function readSubtitleLanguage(value: unknown, fallback: UserSettings["subtitleLanguage"]) {
  return value === "english" || value === "chinese" || value === "both" ? value : fallback;
}
