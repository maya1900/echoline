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

  if (supabase) {
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (user) {
      await supabase.from("study_plans").upsert({
        user_id: user.id,
        daily_minutes: body.dailyMinutes ?? studyPlan.dailyMinutes,
        daily_lines: body.dailyLines ?? studyPlan.dailyLines,
        daily_repeats: body.dailyRepeats ?? studyPlan.dailyRepeats
      });
    }
  }

  return NextResponse.json({ data: { ...studyPlan, ...body } });
}
