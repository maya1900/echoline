import { NextResponse } from "next/server";
import { transcribeRecording } from "@/lib/asr";
import { scoreRepeatAttempt } from "@/lib/scoring/text";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const allowedModes = new Set(["repeat", "call_response"]);
const maxRecordingBytes = 15 * 1024 * 1024;

type ScoreInput = {
  mode: string;
  targetText: string;
  episodeId: string;
  subtitleLineId: string;
  transcript: string;
  audioFile?: File;
  audioUrl?: string;
};

async function readScoreInput(request: Request): Promise<ScoreInput> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const audio = formData.get("audio");

    return {
      mode: String(formData.get("mode") ?? "repeat"),
      targetText: String(formData.get("targetText") ?? ""),
      episodeId: String(formData.get("episodeId") ?? ""),
      subtitleLineId: String(formData.get("subtitleLineId") ?? ""),
      transcript: String(formData.get("transcript") ?? ""),
      audioFile: audio instanceof File ? audio : undefined,
      audioUrl: String(formData.get("audioUrl") ?? "")
    };
  }

  const body = await request.json().catch(() => ({}));

  return {
    mode: typeof body.mode === "string" ? body.mode : "repeat",
    targetText: typeof body.targetText === "string" ? body.targetText : "",
    episodeId: typeof body.episodeId === "string" ? body.episodeId : "",
    subtitleLineId: typeof body.subtitleLineId === "string" ? body.subtitleLineId : "",
    transcript: typeof body.transcript === "string" ? body.transcript : "",
    audioUrl: typeof body.audioUrl === "string" ? body.audioUrl : ""
  };
}

function extensionForAudio(file: File) {
  const fromName = file.name.split(".").pop()?.toLowerCase();

  if (fromName && /^[a-z0-9]+$/.test(fromName)) {
    return fromName;
  }

  if (file.type.includes("mp4")) {
    return "m4a";
  }

  if (file.type.includes("mpeg")) {
    return "mp3";
  }

  if (file.type.includes("wav")) {
    return "wav";
  }

  return "webm";
}

async function ensureRecordingBucket(bucket: string) {
  const adminClient = createSupabaseAdminClient();

  if (!adminClient) {
    return null;
  }

  const { data } = await adminClient.storage.getBucket(bucket);

  if (data) {
    return adminClient;
  }

  const { error } = await adminClient.storage.createBucket(bucket, {
    public: false,
    fileSizeLimit: `${maxRecordingBytes}`
  });

  if (error && !/already exists/i.test(error.message)) {
    throw new Error(error.message);
  }

  return adminClient;
}

async function saveRecording(input: ScoreInput, userId: string, supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>) {
  if (!input.audioFile) {
    return input.audioUrl || null;
  }

  if (input.audioFile.size > maxRecordingBytes) {
    throw new Error("Recording is too large");
  }

  const bucket = process.env.RECORDINGS_BUCKET ?? "recordings";
  const path = `${userId}/${input.episodeId}/${input.subtitleLineId}/${Date.now()}-${crypto.randomUUID()}.${extensionForAudio(input.audioFile)}`;
  const storageClient = (await ensureRecordingBucket(bucket)) ?? supabase;
  const { error } = await storageClient.storage.from(bucket).upload(path, input.audioFile, {
    contentType: input.audioFile.type || "audio/webm",
    upsert: false
  });

  if (error) {
    if (/bucket not found/i.test(error.message)) {
      return null;
    }

    throw new Error(error.message);
  }

  return `${bucket}/${path}`;
}

export async function POST(request: Request) {
  const input = await readScoreInput(request);
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

  if (!input.episodeId || !input.subtitleLineId || !input.targetText) {
    return NextResponse.json({ error: "Missing scoring input" }, { status: 400 });
  }

  const mode = allowedModes.has(input.mode) ? input.mode : "repeat";
  const asrTranscript = input.transcript.trim()
    ? undefined
    : await transcribeRecording({
        file: input.audioFile,
        targetText: input.targetText
      });
  const transcript = input.transcript.trim() || asrTranscript || "";
  const fallbackTranscript = transcript.length === 0;
  const attempt = scoreRepeatAttempt({
    targetText: input.targetText,
    transcript,
    fallbackTranscript
  });
  let audioUrl: string | null = null;

  try {
    audioUrl = await saveRecording(input, user.id, supabase);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to save recording" }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("repeat_attempts")
    .insert({
      user_id: user.id,
      episode_id: input.episodeId,
      subtitle_line_id: input.subtitleLineId,
      mode,
      target_text: input.targetText,
      transcript: attempt.transcript,
      audio_url: audioUrl,
      accuracy: attempt.accuracy,
      completeness: attempt.completeness,
      fluency: null,
      overall: attempt.overall,
      feedback: attempt.feedback
    })
    .select("transcript,accuracy,completeness,overall,feedback")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Failed to save repeat attempt" }, { status: 500 });
  }

  return NextResponse.json({
    data: {
      transcript: data.transcript ?? attempt.transcript,
      accuracy: data.accuracy ?? attempt.accuracy,
      completeness: data.completeness ?? attempt.completeness,
      audioUrl,
      missedWords: attempt.missedWords,
      overall: data.overall ?? attempt.overall,
      feedback: data.feedback ?? attempt.feedback
    }
  });
}
