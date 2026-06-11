import { NextResponse } from "next/server";
import { requireUserRequest } from "@/lib/auth/api";
import { getStudyPlan } from "@/lib/data";
import { studyPlans } from "@/lib/db/schema";

function readInteger(value: unknown, fallback: number, min: number, max: number) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const parsed = typeof value === "number" ? value : Number(value);

  return Number.isInteger(parsed) ? Math.min(Math.max(parsed, min), max) : fallback;
}

export async function GET() {
  const auth = await requireUserRequest();

  if (auth.error) {
    return auth.error;
  }

  const studyPlan = await getStudyPlan();
  return NextResponse.json({ data: studyPlan });
}

export async function POST(request: Request) {
  const auth = await requireUserRequest();

  if (auth.error) {
    return auth.error;
  }

  const studyPlan = await getStudyPlan();
  const body = await request.json().catch(() => ({}));
  const nextPlan = {
    dailyMinutes: readInteger(body.dailyMinutes, studyPlan.dailyMinutes, 5, 240),
    dailyLines: readInteger(body.dailyLines, studyPlan.dailyLines, 1, 500),
    dailyRepeats: readInteger(body.dailyRepeats, studyPlan.dailyRepeats, 0, 500)
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
