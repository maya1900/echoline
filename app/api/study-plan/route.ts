import { NextResponse } from "next/server";
import { getStudyPlan } from "@/lib/data";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const studyPlan = await getStudyPlan();
  return NextResponse.json({ data: studyPlan });
}

export async function POST(request: Request) {
  const studyPlan = await getStudyPlan();
  const body = await request.json().catch(() => ({}));
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const nextPlan = {
    dailyMinutes: body.dailyMinutes ?? studyPlan.dailyMinutes,
    dailyLines: body.dailyLines ?? studyPlan.dailyLines,
    dailyRepeats: body.dailyRepeats ?? studyPlan.dailyRepeats
  };
  const { error } = await supabase.from("study_plans").upsert({
    user_id: user.id,
    daily_minutes: nextPlan.dailyMinutes,
    daily_lines: nextPlan.dailyLines,
    daily_repeats: nextPlan.dailyRepeats
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: { ...studyPlan, ...nextPlan } });
}
