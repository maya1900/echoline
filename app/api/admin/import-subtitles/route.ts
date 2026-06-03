import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const supabase = await createSupabaseServerClient();

  if (supabase) {
    const {
      data: { user }
    } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from("admin_import_jobs")
      .insert({
        admin_id: user?.id,
        episode_id: body.episodeId,
        source_filename: body.sourceFilename ?? body.title ?? "subtitles.srt",
        status: "pending",
        parsed_lines: 0
      })
      .select("id,source_filename,status,parsed_lines,error_message,created_at")
      .single();

    if (!error && data) {
      return NextResponse.json({ data }, { status: 202 });
    }
  }

  return NextResponse.json(
    {
      data: {
        id: `job-${Date.now()}`,
        status: "queued",
        title: body.title ?? "字幕导入任务",
        result: "已接收，等待解析。"
      }
    },
    { status: 202 }
  );
}
