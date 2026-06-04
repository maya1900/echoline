import { NextResponse } from "next/server";
import { defaultSiteSettings, getSiteSettings, normalizeSiteSettings } from "@/lib/admin-data";
import { requireAdminRequest } from "@/lib/auth/api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const admin = await requireAdminRequest();

  if (admin.error) {
    return admin.error;
  }

  const settings = await getSiteSettings();

  return NextResponse.json({ data: settings });
}

export async function PATCH(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const admin = await requireAdminRequest();

  if (admin.error) {
    return admin.error;
  }

  const supabaseAdmin = createSupabaseAdminClient();

  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase service role is not configured" }, { status: 503 });
  }

  const { data: currentRow } = await supabaseAdmin.from("site_settings").select("value").eq("key", "global").maybeSingle();
  const currentValue = (currentRow?.value as Record<string, unknown> | null) ?? {};
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
  const { data, error } = await supabaseAdmin
    .from("site_settings")
    .upsert(
      {
        key: "global",
        value: storedSettings,
        updated_by: admin.user.id,
        updated_at: new Date().toISOString()
      },
      { onConflict: "key" }
    )
    .select("value")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Failed to save settings" }, { status: 500 });
  }

  return NextResponse.json({ data: normalizeSiteSettings(data.value as Record<string, unknown>) });
}
