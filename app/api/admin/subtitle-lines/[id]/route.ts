import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/auth/api";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = await requireAdminRequest();

  if (admin.error) {
    return admin.error;
  }

  const body = await request.json().catch(() => ({}));

  const { data, error } = await admin.supabase
    .from("subtitle_lines")
    .update({
      english_text: body.englishText,
      chinese_text: body.chineseText,
      start_ms: body.startMs,
      end_ms: body.endMs,
      difficulty: body.difficulty,
      keywords: body.keywords
    })
    .eq("id", id)
    .select("id,episode_id,line_index,start_ms,end_ms,english_text,chinese_text,difficulty,keywords")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Subtitle line not found" }, { status: 404 });
  }

  return NextResponse.json({ data });
}
