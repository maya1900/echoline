import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AdminUser, SiteSettings } from "@/lib/types";

type ProfileRow = {
  id: string;
  email: string | null;
  display_name: string | null;
  role: "user" | "admin";
  created_at: string;
};

type SiteSettingsRow = {
  value: Record<string, unknown>;
};

export const defaultSiteSettings: SiteSettings = {
  appName: "Your English Coach",
  workspaceSubtitle: "看剧学英语工作台",
  defaultDailyMinutes: 25,
  defaultDailyLines: 18,
  defaultDailyRepeats: 8,
  aiScoringEnabled: true,
  dictionaryAiEnabled: true,
  dictionaryProvider: "bigmodel",
  dictionaryModel: "glm-4-flash",
  dictionaryApiKeyConfigured: Boolean(process.env.DICTIONARY_AI_API_KEY),
  allowPublicSignup: true
};

export async function listAdminUsers(): Promise<AdminUser[]> {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return [];
  }

  const [profilesResult, authUsersResult] = await Promise.all([
    supabase.from("profiles").select("id,email,display_name,role,created_at").order("created_at", { ascending: false }),
    supabase.auth.admin.listUsers({ page: 1, perPage: 200 })
  ]);

  if (profilesResult.error || authUsersResult.error) {
    return [];
  }

  const authUsersById = new Map(authUsersResult.data.users.map((user) => [user.id, user]));

  return ((profilesResult.data ?? []) as ProfileRow[]).map((profile) => {
    const authUser = authUsersById.get(profile.id);
    const email = profile.email ?? authUser?.email ?? "";

    return {
      id: profile.id,
      email,
      displayName: profile.display_name ?? email.split("@")[0] ?? "未命名用户",
      role: profile.role,
      createdAt: formatDateTime(profile.created_at),
      lastSignInAt: authUser?.last_sign_in_at ? formatDateTime(authUser.last_sign_in_at) : "从未登录"
    };
  });
}

export async function getSiteSettings(): Promise<SiteSettings> {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return defaultSiteSettings;
  }

  const { data, error } = await supabase.from("site_settings").select("value").eq("key", "global").maybeSingle();

  if (error || !data) {
    return defaultSiteSettings;
  }

  return normalizeSiteSettings((data as SiteSettingsRow).value);
}

export function normalizeSiteSettings(value: Record<string, unknown>): SiteSettings {
  const dictionaryApiKeyConfigured = readBoolean(
    value.dictionaryApiKeyConfigured,
    typeof value.dictionaryApiKey === "string" && value.dictionaryApiKey.trim().length > 0
  );

  return {
    appName: readString(value.appName, defaultSiteSettings.appName),
    workspaceSubtitle: readString(value.workspaceSubtitle, defaultSiteSettings.workspaceSubtitle),
    defaultDailyMinutes: readNumber(value.defaultDailyMinutes, defaultSiteSettings.defaultDailyMinutes),
    defaultDailyLines: readNumber(value.defaultDailyLines, defaultSiteSettings.defaultDailyLines),
    defaultDailyRepeats: readNumber(value.defaultDailyRepeats, defaultSiteSettings.defaultDailyRepeats),
    aiScoringEnabled: readBoolean(value.aiScoringEnabled, defaultSiteSettings.aiScoringEnabled),
    dictionaryAiEnabled: readBoolean(value.dictionaryAiEnabled, defaultSiteSettings.dictionaryAiEnabled),
    dictionaryProvider: readString(value.dictionaryProvider, defaultSiteSettings.dictionaryProvider),
    dictionaryModel: readString(value.dictionaryModel, defaultSiteSettings.dictionaryModel),
    dictionaryApiKeyConfigured: dictionaryApiKeyConfigured || Boolean(process.env.DICTIONARY_AI_API_KEY),
    allowPublicSignup: readBoolean(value.allowPublicSignup, defaultSiteSettings.allowPublicSignup)
  };
}

export async function getDictionaryAiSettings() {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return {
      provider: process.env.DICTIONARY_AI_PROVIDER ?? defaultSiteSettings.dictionaryProvider,
      model: process.env.DICTIONARY_AI_MODEL ?? defaultSiteSettings.dictionaryModel,
      apiKey: process.env.DICTIONARY_AI_API_KEY ?? ""
    };
  }

  const { data, error } = await supabase.from("site_settings").select("value").eq("key", "global").maybeSingle();
  const value = !error && data ? ((data as SiteSettingsRow).value ?? {}) : {};

  return {
    provider: readString(value.dictionaryProvider, process.env.DICTIONARY_AI_PROVIDER ?? defaultSiteSettings.dictionaryProvider),
    model: readString(value.dictionaryModel, process.env.DICTIONARY_AI_MODEL ?? defaultSiteSettings.dictionaryModel),
    apiKey: readString(value.dictionaryApiKey, process.env.DICTIONARY_AI_API_KEY ?? "")
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

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}
