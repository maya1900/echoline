import { NextResponse } from "next/server";
import { requireUserRequest } from "@/lib/auth/api";
import { getStudyPlan } from "@/lib/data";
import { studyPlans } from "@/lib/db/schema";

export async function GET() {
  const studyPlan = await getStudyPlan();
  return NextResponse.json({ data: studyPlan });
}

export async function POST(request: Request) {
  const studyPlan = await getStudyPlan();
  const body = await request.json().catch(() => ({}));
  const auth = await requireUserRequest();

  if (auth.error) {
    return auth.error;
  }

  const nextPlan = {
    dailyMinutes: body.dailyMinutes ?? studyPlan.dailyMinutes,
    dailyLines: body.dailyLines ?? studyPlan.dailyLines,
    dailyRepeats: body.dailyRepeats ?? studyPlan.dailyRepeats
  };
  const now = new Date();

  try {
    await auth.db
      .insert(studyPlans)
      .values({
        userId: auth.user.id,
        dailyMinutes: nextPlan.dailyMinutes,
        dailyLines: nextPlan.dailyLines,
        dailyRepeats: nextPlan.dailyRepeats,
        updatedAt: now
      })
      .onConflictDoUpdate({
        target: studyPlans.userId,
        set: {
          dailyMinutes: nextPlan.dailyMinutes,
          dailyLines: nextPlan.dailyLines,
          dailyRepeats: nextPlan.dailyRepeats,
          updatedAt: now
        }
      });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to save study plan" }, { status: 500 });
  }

  return NextResponse.json({ data: { ...studyPlan, ...nextPlan } });
}
