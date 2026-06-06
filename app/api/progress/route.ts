import { NextResponse } from "next/server";
import { requireUserRequest } from "@/lib/auth/api";
import { getProgressData } from "@/lib/data";
import { learningProgress } from "@/lib/db/schema";

const allowedModes = new Set(["rough", "intensive", "loop", "repeat", "call_response"]);

export async function GET() {
  const { rows: progressRows, summary: progressSummary } = await getProgressData();
  return NextResponse.json({ data: { summary: progressSummary, rows: progressRows } });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const auth = await requireUserRequest();

  if (auth.error) {
    return auth.error;
  }

  if (!body.episodeId || !body.subtitleLineId || !body.mode) {
    return NextResponse.json({ error: "Missing progress input" }, { status: 400 });
  }

  if (typeof body.mode !== "string" || !allowedModes.has(body.mode)) {
    return NextResponse.json({ error: "Invalid learning mode" }, { status: 400 });
  }

  const now = new Date();
  const mode = body.mode as "rough" | "intensive" | "loop" | "repeat" | "call_response";

  try {
    await auth.db
      .insert(learningProgress)
      .values({
        userId: auth.user.id,
        seriesId: body.seriesId,
        episodeId: body.episodeId,
        subtitleLineId: body.subtitleLineId,
        mode,
        playbackPositionMs: body.playbackPositionMs ?? 0,
        completed: body.completed ?? false,
        repeatCount: body.repeatCount ?? 0,
        bestScore: body.bestScore,
        lastStudiedAt: now,
        updatedAt: now
      })
      .onConflictDoUpdate({
        target: [learningProgress.userId, learningProgress.episodeId, learningProgress.subtitleLineId, learningProgress.mode],
        set: {
          seriesId: body.seriesId,
          playbackPositionMs: body.playbackPositionMs ?? 0,
          completed: body.completed ?? false,
          repeatCount: body.repeatCount ?? 0,
          bestScore: body.bestScore,
          lastStudiedAt: now,
          updatedAt: now
        }
      });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to save progress" }, { status: 500 });
  }

  return NextResponse.json({ data: { ...body, saved: true } });
}
