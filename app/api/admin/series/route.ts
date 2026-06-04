import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/auth/api";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const admin = await requireAdminRequest();

  if (admin.error) {
    return admin.error;
  }

  const { data, error } = await admin.supabase
    .from("series")
    .insert({
      title: body.title,
      original_title: body.originalTitle,
      description: body.description,
      cover_url: body.coverUrl,
      difficulty: body.difficulty ?? "B1",
      genre: body.genre,
      status: body.status ?? "draft",
      created_by: admin.user.id
    })
    .select("id,title,original_title,description,cover_url,difficulty,genre,status")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Failed to create series" }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 201 });
}
