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

  const settings = normalizeSiteSettings({ ...defaultSiteSettings, ...body });
  const { data, error } = await supabaseAdmin
    .from("site_settings")
    .upsert(
      {
        key: "global",
        value: settings,
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
