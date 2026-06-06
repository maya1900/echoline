import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { profiles, siteSettings, users } from "@/lib/db/schema";
import type { AdminUser, SiteSettings } from "@/lib/types";

type SiteSettingsRow = {
  value: Record<string, unknown>;
};

export const defaultSiteSettings: SiteSettings = {
  appName: "追句 EchoLine",
  workspaceSubtitle: "逐句看剧学英语工作台",
  defaultDailyMinutes: 25,
  defaultDailyLines: 18,
  defaultDailyRepeats: 8,
  aiScoringEnabled: true,
  dictionaryAiEnabled: true,
  dictionaryProvider: "bigmodel",
  dictionaryModel: "glm-4-flash",
  dictionaryApiKeyConfigured: false,
  allowPublicSignup: true
};

export async function listAdminUsers(): Promise<AdminUser[]> {
  const db = getDb();

  if (!db) {
    return [];
  }

  const rows = await db
    .select({
      id: profiles.id,
      email: profiles.email,
      displayName: profiles.displayName,
      role: profiles.role,
      createdAt: profiles.createdAt,
      lastSignInAt: users.lastSignInAt
    })
    .from(profiles)
    .leftJoin(users, eq(users.id, profiles.id))
    .orderBy(desc(profiles.createdAt))
    .limit(200);

  return rows.map((profile) => {
    const email = profile.email ?? "";

    return {
      id: profile.id,
      email,
      displayName: profile.displayName ?? email.split("@")[0] ?? "未命名用户",
      role: profile.role,
      createdAt: formatDateTime(profile.createdAt),
      lastSignInAt: profile.lastSignInAt ? formatDateTime(profile.lastSignInAt) : "从未登录"
    };
  });
}

export async function getSiteSettings(): Promise<SiteSettings> {
  const db = getDb();

  if (!db) {
    return defaultSiteSettings;
  }

  const [data] = await db.select({ value: siteSettings.value }).from(siteSettings).where(eq(siteSettings.key, "global")).limit(1);

  if (!data) {
    return defaultSiteSettings;
  }

  return normalizeSiteSettings((data as SiteSettingsRow).value);
}

export async function getRawSiteSettingsValue() {
  const db = getDb();

  if (!db) {
    return {};
  }

  const [data] = await db.select({ value: siteSettings.value }).from(siteSettings).where(eq(siteSettings.key, "global")).limit(1);
  return (data?.value as Record<string, unknown> | undefined) ?? {};
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
    dictionaryApiKeyConfigured,
    allowPublicSignup: readBoolean(value.allowPublicSignup, defaultSiteSettings.allowPublicSignup)
  };
}

export async function getDictionaryAiSettings() {
  const value = await getRawSiteSettingsValue();

  return {
    enabled: readBoolean(value.dictionaryAiEnabled, defaultSiteSettings.dictionaryAiEnabled),
    provider: readString(value.dictionaryProvider, defaultSiteSettings.dictionaryProvider),
    model: readString(value.dictionaryModel, defaultSiteSettings.dictionaryModel),
    apiKey: readString(value.dictionaryApiKey, "")
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

function formatDateTime(value: Date | string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}
