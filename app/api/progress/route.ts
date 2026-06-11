import { NextResponse } from "next/server";
import { requireUserRequest } from "@/lib/auth/api";
import { getProgressData } from "@/lib/data";
import { learningProgress } from "@/lib/db/schema";

const allowedModes = new Set(["rough", "intensive", "loop", "repeat", "call_response"]);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const maxPlaybackPositionMs = 24 * 60 * 60 * 1000;

function readUuid(value: unknown) {
  return typeof value === "string" && uuidPattern.test(value.trim()) ? value.trim() : "";
}

function readOptionalUuid(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  return readUuid(value);
}

function readInteger(value: unknown, fallback: number, min: number, max: number) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const parsed = typeof value === "number" ? value : Number(value);

  if (!Number.isInteger(parsed)) {
    return null;
  }

  return Math.min(Math.max(parsed, min), max);
}

function readOptionalScore(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  return readInteger(value, 0, 0, 100);
}

export async function GET() {
  const auth = await requireUserRequest();

  if (auth.error) {
    return auth.error;
  }

  const { rows: progressRows, summary: progressSummary } = await getProgressData();
  return NextResponse.json({ data: { summary: progressSummary, rows: progressRows } });
}

export async function POST(request: Request) {
  const auth = await requireUserRequest();

  if (auth.error) {
    return auth.error;
  }

  const body = await request.json().catch(() => ({}));

  const seriesId = readOptionalUuid(body.seriesId);
  const episodeId = readUuid(body.episodeId);
  const subtitleLineId = readUuid(body.subtitleLineId);
  const playbackPositionMs = readInteger(body.playbackPositionMs, 0, 0, maxPlaybackPositionMs);
  const repeatCount = readInteger(body.repeatCount, 0, 0, 10_000);
  const bestScore = readOptionalScore(body.bestScore);

  if (!body.episodeId || !body.subtitleLineId || !body.mode) {
    return NextResponse.json({ error: "Missing progress input" }, { status: 400 });
  }

  if (!episodeId || !subtitleLineId || seriesId === "" || playbackPositionMs === null || repeatCount === null || bestScore === null) {
    return NextResponse.json({ error: "Invalid progress input" }, { status: 400 });
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
        seriesId,
        episodeId,
        subtitleLineId,
        mode,
        playbackPositionMs,
        completed: body.completed === true,
        repeatCount,
        bestScore,
        lastStudiedAt: now,
        updatedAt: now
      })
      .onConflictDoUpdate({
        target: [learningProgress.userId, learningProgress.episodeId, learningProgress.subtitleLineId, learningProgress.mode],
        set: {
          seriesId,
          playbackPositionMs,
          completed: body.completed === true,
          repeatCount,
          bestScore,
          lastStudiedAt: now,
          updatedAt: now
        }
      });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to save progress" }, { status: 500 });
  }

  return NextResponse.json({
    data: {
      seriesId,
      episodeId,
      subtitleLineId,
      mode,
      playbackPositionMs,
      completed: body.completed === true,
      repeatCount,
      bestScore,
      saved: true
    }
  });
}
