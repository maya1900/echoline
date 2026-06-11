import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireUserRequest } from "@/lib/auth/api";
import { profiles } from "@/lib/db/schema";
import { canSealSecretValue, isEncryptedSecretValue, sealSecretValue } from "@/lib/secret-values";
import { defaultUserSettings, getCurrentUserSettings } from "@/lib/user-settings";

function readSubtitleLanguage(value: unknown) {
  return value === "english" || value === "chinese" || value === "both" ? value : undefined;
}

function readPlaybackRate(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }

  return Math.min(Math.max(value, 0.5), 1.25);
}

export async function GET() {
  const auth = await requireUserRequest();

  if (auth.error) {
    return auth.error;
  }

  const settings = await getCurrentUserSettings();
  return NextResponse.json({ data: settings });
}

export async function PATCH(request: Request) {
  const auth = await requireUserRequest();

  if (auth.error) {
    return auth.error;
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const [currentRow] = await auth.db.select({ asrApiKey: profiles.asrApiKey }).from(profiles).where(eq(profiles.id, auth.user.id)).limit(1);

  const nextAsrApiKey = typeof body.asrApiKey === "string" ? body.asrApiKey.trim() : "";
  const update = {
    subtitleLanguage: readSubtitleLanguage(body.subtitleLanguage) ?? defaultUserSettings.subtitleLanguage,
    defaultPlaybackRate: String(readPlaybackRate(body.defaultPlaybackRate) ?? defaultUserSettings.defaultPlaybackRate),
    autoLoop: typeof body.autoLoop === "boolean" ? body.autoLoop : defaultUserSettings.autoLoop,
    aiScoringEnabled: typeof body.aiScoringEnabled === "boolean" ? body.aiScoringEnabled : defaultUserSettings.aiScoringEnabled,
    asrProvider: typeof body.asrProvider === "string" && body.asrProvider.trim() ? body.asrProvider.trim() : defaultUserSettings.asrProvider,
    asrModel: typeof body.asrModel === "string" && body.asrModel.trim() ? body.asrModel.trim() : defaultUserSettings.asrModel,
    asrApiKey: currentRow?.asrApiKey ?? null,
    updatedAt: new Date()
  };

  if (nextAsrApiKey) {
    if (!canSealSecretValue()) {
      return NextResponse.json({ error: "API Key 加密密钥未配置，请先设置 API_KEY_ENCRYPTION_SECRET 或使用环境变量配置 ASR Key。" }, { status: 500 });
    }

    update.asrApiKey = sealSecretValue(nextAsrApiKey);
  } else if (typeof currentRow?.asrApiKey === "string" && currentRow.asrApiKey.trim()) {
    const currentAsrApiKey = currentRow.asrApiKey.trim();
    update.asrApiKey = canSealSecretValue() && !isEncryptedSecretValue(currentAsrApiKey) ? sealSecretValue(currentAsrApiKey) : currentAsrApiKey;
  }

  try {
    await auth.db.update(profiles).set(update).where(eq(profiles.id, auth.user.id));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to save settings" }, { status: 500 });
  }

  const settings = await getCurrentUserSettings();
  return NextResponse.json({ data: settings });
}
