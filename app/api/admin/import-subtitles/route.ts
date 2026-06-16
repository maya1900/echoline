import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/auth/api";
import { adminImportJobs, subtitleLines } from "@/lib/db/schema";
import { parseSubtitleText } from "@/lib/subtitles/parser";

type SubtitleImportInput = {
  episodeId?: string;
  sourceFilename: string;
  subtitleText: string;
};

function sqlExcluded(column: string) {
  return sql.raw(`excluded.${column}`);
}

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

  const [job] = await admin.db
    .insert(adminImportJobs)
    .values({
      adminId: admin.user.id,
      episodeId: input.episodeId,
      sourceFilename: input.sourceFilename,
      status: "processing",
      parsedLines: 0
    })
    .returning({ id: adminImportJobs.id });

  if (!job) {
    return NextResponse.json({ error: "Failed to create import job" }, { status: 500 });
  }

  const rows = lines.map((line) => ({
    episodeId: input.episodeId!,
    lineIndex: line.lineIndex,
    startMs: line.startMs,
    endMs: line.endMs,
    englishText: line.englishText,
    chineseText: line.chineseText,
    keywords: line.keywords
  }));
  let lineError: Error | null = null;

  try {
    await admin.db
      .insert(subtitleLines)
      .values(rows)
      .onConflictDoUpdate({
        target: [subtitleLines.episodeId, subtitleLines.lineIndex],
        set: {
          startMs: sqlExcluded("start_ms"),
          endMs: sqlExcluded("end_ms"),
          englishText: sqlExcluded("english_text"),
          chineseText: sqlExcluded("chinese_text"),
          keywords: sqlExcluded("keywords"),
          updatedAt: new Date()
        }
      });
  } catch (error) {
    lineError = error instanceof Error ? error : new Error("Failed to import subtitle lines");
  }

  const status = lineError ? "failed" : "completed";

  const [updatedJob] = await admin.db
    .update(adminImportJobs)
    .set({
      status,
      parsedLines: lineError ? 0 : lines.length,
      errorMessage: lineError?.message,
      updatedAt: new Date()
    })
    .where(eq(adminImportJobs.id, job.id))
    .returning({
      id: adminImportJobs.id,
      source_filename: adminImportJobs.sourceFilename,
      status: adminImportJobs.status,
      parsed_lines: adminImportJobs.parsedLines,
      error_message: adminImportJobs.errorMessage,
      created_at: adminImportJobs.createdAt
    });

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
