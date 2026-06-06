import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/auth/api";
import { subtitleLines } from "@/lib/db/schema";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = await requireAdminRequest();

  if (admin.error) {
    return admin.error;
  }

  const body = await request.json().catch(() => ({}));

  const [data] = await admin.db
    .update(subtitleLines)
    .set({
      englishText: body.englishText,
      chineseText: body.chineseText,
      startMs: body.startMs,
      endMs: body.endMs,
      difficulty: body.difficulty,
      keywords: body.keywords,
      updatedAt: new Date()
    })
    .where(eq(subtitleLines.id, id))
    .returning({
      id: subtitleLines.id,
      episode_id: subtitleLines.episodeId,
      line_index: subtitleLines.lineIndex,
      start_ms: subtitleLines.startMs,
      end_ms: subtitleLines.endMs,
      english_text: subtitleLines.englishText,
      chinese_text: subtitleLines.chineseText,
      difficulty: subtitleLines.difficulty,
      keywords: subtitleLines.keywords
    });

  if (!data) {
    return NextResponse.json({ error: "Subtitle line not found" }, { status: 404 });
  }

  return NextResponse.json({ data });
}
