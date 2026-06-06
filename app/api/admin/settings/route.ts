import { NextResponse } from "next/server";
import { defaultSiteSettings, getRawSiteSettingsValue, getSiteSettings, normalizeSiteSettings } from "@/lib/admin-data";
import { requireAdminRequest } from "@/lib/auth/api";
import { siteSettings } from "@/lib/db/schema";

export async function GET() {
  const admin = await requireAdminRequest();

  if (admin.error) {
    return admin.error;
  }

  const settings = await getSiteSettings();

  return NextResponse.json({ data: settings });
}

export async function PATCH(request: Request) {
  const admin = await requireAdminRequest();

  if (admin.error) {
    return admin.error;
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const currentValue = await getRawSiteSettingsValue();
  const nextValue: Record<string, unknown> = { ...defaultSiteSettings, ...currentValue, ...body };
  const nextApiKey = typeof body.dictionaryApiKey === "string" ? body.dictionaryApiKey.trim() : "";

  if (nextApiKey) {
    nextValue.dictionaryApiKey = nextApiKey;
    nextValue.dictionaryApiKeyConfigured = true;
  } else if (typeof currentValue.dictionaryApiKey === "string" && currentValue.dictionaryApiKey.trim()) {
    nextValue.dictionaryApiKey = currentValue.dictionaryApiKey;
    nextValue.dictionaryApiKeyConfigured = true;
  } else {
    delete nextValue.dictionaryApiKey;
    nextValue.dictionaryApiKeyConfigured = false;
  }

  const settings = normalizeSiteSettings(nextValue);
  const storedSettings = { ...settings, dictionaryApiKey: nextValue.dictionaryApiKey };
  const [data] = await admin.db
    .insert(siteSettings)
    .values({
      key: "global",
      value: storedSettings,
      updatedBy: admin.user.id,
      updatedAt: new Date()
    })
    .onConflictDoUpdate({
      target: siteSettings.key,
      set: {
        value: storedSettings,
        updatedBy: admin.user.id,
        updatedAt: new Date()
      }
    })
    .returning({ value: siteSettings.value });

  if (!data) {
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }

  return NextResponse.json({ data: normalizeSiteSettings(data.value as Record<string, unknown>) });
}
