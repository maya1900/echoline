import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/auth/api";
import { parseSubtitleText } from "@/lib/subtitles/parser";

type SubtitleImportInput = {
  episodeId?: string;
  sourceFilename: string;
  subtitleText: string;
};

export async function POST(request: Request) {
  const admin = await requireAdminRequest();

  if (admin.error) {
    return admin.error;
  }

  const input = await readSubtitleImportInput(request);
  const lines = parseSubtitleText(input.subtitleText);

  if (!input.episodeId) {
    return NextResponse.json({ error: "Missing episodeId" }, { status: 400 });
  }

  if (lines.length === 0) {
    return NextResponse.json({ error: "No subtitle cues parsed" }, { status: 400 });
  }

  const { data: job, error: jobError } = await admin.supabase
    .from("admin_import_jobs")
    .insert({
      admin_id: admin.user.id,
      episode_id: input.episodeId,
      source_filename: input.sourceFilename,
      status: "processing",
      parsed_lines: 0
    })
    .select("id")
    .single();

  if (jobError || !job) {
    return NextResponse.json({ error: jobError?.message ?? "Failed to create import job" }, { status: 500 });
  }

  const rows = lines.map((line) => ({
    episode_id: input.episodeId,
    line_index: line.lineIndex,
    start_ms: line.startMs,
    end_ms: line.endMs,
    english_text: line.englishText,
    chinese_text: line.chineseText,
    keywords: line.keywords
  }));
  const { error: lineError } = await admin.supabase.from("subtitle_lines").upsert(rows, { onConflict: "episode_id,line_index" });
  const status = lineError ? "failed" : "completed";

  const { data: updatedJob } = await admin.supabase
    .from("admin_import_jobs")
    .update({
      status,
      parsed_lines: lineError ? 0 : lines.length,
      error_message: lineError?.message
    })
    .eq("id", job.id)
    .select("id,source_filename,status,parsed_lines,error_message,created_at")
    .single();

  if (lineError) {
    return NextResponse.json({ error: lineError.message, data: { job: updatedJob } }, { status: 500 });
  }

  return NextResponse.json({ data: { job: updatedJob, lines } }, { status: 201 });
}

async function readSubtitleImportInput(request: Request): Promise<SubtitleImportInput> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const file = formData.get("file");
    const subtitleText = file instanceof File ? await file.text() : String(formData.get("subtitleText") ?? "");

    return {
      episodeId: String(formData.get("episodeId") ?? ""),
      sourceFilename: file instanceof File ? file.name : String(formData.get("sourceFilename") ?? "subtitles.srt"),
      subtitleText
    };
  }

  const body = await request.json().catch(() => ({}));

  return {
    episodeId: body.episodeId,
    sourceFilename: body.sourceFilename ?? body.title ?? "subtitles.srt",
    subtitleText: body.subtitleText ?? body.content ?? ""
  };
}
