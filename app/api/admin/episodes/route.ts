import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/auth/api";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const admin = await requireAdminRequest();

  if (admin.error) {
    return admin.error;
  }

  const { data, error } = await admin.supabase
    .from("episodes")
    .insert({
      series_id: body.seriesId,
      season_number: body.seasonNumber ?? 1,
      episode_number: body.episodeNumber,
      title: body.title,
      description: body.description,
      media_url: body.mediaUrl,
      duration_seconds: body.durationSeconds,
      status: body.status ?? "draft"
    })
    .select("id,series_id,season_number,episode_number,title,description,media_url,duration_seconds,status")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Failed to create episode" }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 201 });
}
