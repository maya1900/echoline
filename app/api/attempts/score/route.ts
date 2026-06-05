import { NextResponse } from "next/server";
import { transcribeRecordingWithDiagnostics } from "@/lib/asr";
import { scoreRepeatAttempt } from "@/lib/scoring/text";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAsrSettingsForUser } from "@/lib/user-settings";

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

function getAsrFallbackFeedback({
  hasAudioFile,
  asrEnabled,
  apiKey,
  provider,
  asrError,
  emptyTranscript
}: {
  hasAudioFile: boolean;
  asrEnabled: boolean;
  apiKey: string;
  provider: string;
  asrError?: string;
  emptyTranscript?: boolean;
}) {
  if (!hasAudioFile) {
    return "没有收到录音文件，本次无法评分，请重新录音。";
  }

  if (!asrEnabled) {
    return "跟读评分未启用，本次不计入完成。";
  }

  if (!apiKey) {
    return `ASR API Key 未保存或未配置（${provider}），本次不计入完成。`;
  }

  if (emptyTranscript) {
    return `${provider} 连接成功，但没有解析到转写文本；请检查音频格式或重新录音。`;
  }

  if (asrError) {
    return `${provider} 转写失败：${asrError}`;
  }

  return `${provider} 未返回真实转写，本次无法评分，请重新录音。`;
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

  if (!input.episodeId || !input.subtitleLineId || !input.targetText.trim()) {
    return NextResponse.json({ error: "Missing scoring input" }, { status: 400 });
  }

  if (input.transcript.trim()) {
    return NextResponse.json({ error: "Transcript input is not accepted for scored attempts" }, { status: 400 });
  }

  const { data: subtitleLine, error: subtitleLineError } = await supabase
    .from("subtitle_lines")
    .select("english_text")
    .eq("episode_id", input.episodeId)
    .eq("id", input.subtitleLineId)
    .maybeSingle();

  if (subtitleLineError) {
    return NextResponse.json({ error: "Failed to load subtitle line" }, { status: 500 });
  }

  if (!subtitleLine) {
    return NextResponse.json({ error: "Subtitle line not found" }, { status: 404 });
  }

  const targetText = typeof subtitleLine.english_text === "string" ? subtitleLine.english_text : "";

  if (!targetText.trim()) {
    return NextResponse.json({ error: "Subtitle line has no English text" }, { status: 400 });
  }

  if (input.targetText.trim() !== targetText.trim()) {
    return NextResponse.json({ error: "Target text does not match subtitle line" }, { status: 409 });
  }

  const mode = allowedModes.has(input.mode) ? input.mode : "repeat";
  const asrSettings = await getAsrSettingsForUser(user.id);
  const asrResult = await transcribeRecordingWithDiagnostics({
    file: input.audioFile,
    targetText,
    settings: asrSettings
  });
  const transcript = asrResult.transcript?.trim() ?? "";
  const fallbackTranscript = transcript.length === 0;
  const fallbackFeedback = fallbackTranscript
    ? getAsrFallbackFeedback({
        hasAudioFile: Boolean(input.audioFile),
        asrEnabled: asrSettings.enabled,
        apiKey: asrSettings.apiKey,
        provider: asrSettings.provider,
        asrError: asrResult.error,
        emptyTranscript: asrResult.emptyTranscript
      })
    : undefined;
  const attempt = scoreRepeatAttempt({
    targetText,
    transcript,
    fallbackTranscript,
    fallbackFeedback
  });

  if (attempt.scorable === false) {
    return NextResponse.json({
      data: {
        transcript: attempt.transcript,
        accuracy: attempt.accuracy,
        completeness: attempt.completeness,
        audioUrl: null,
        missedWords: attempt.missedWords,
        overall: attempt.overall,
        feedback: attempt.feedback,
        scorable: attempt.scorable,
        emptyTranscript: attempt.emptyTranscript,
        reason: attempt.reason
      }
    });
  }

  let audioUrl: string | null = null;

  try {
    audioUrl = await saveRecording(input, user.id, supabase);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to save recording" }, { status: 500 });
  }

  const { data: savedAttempt, error } = await supabase
    .from("repeat_attempts")
    .insert({
      user_id: user.id,
      episode_id: input.episodeId,
      subtitle_line_id: input.subtitleLineId,
      mode,
      target_text: targetText,
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

  if (error || !savedAttempt) {
    return NextResponse.json({ error: error?.message ?? "Failed to save repeat attempt" }, { status: 500 });
  }

  return NextResponse.json({
    data: {
      transcript: savedAttempt.transcript ?? attempt.transcript,
      accuracy: savedAttempt.accuracy ?? attempt.accuracy,
      completeness: savedAttempt.completeness ?? attempt.completeness,
      audioUrl,
      missedWords: attempt.missedWords,
      overall: savedAttempt.overall ?? attempt.overall,
      feedback: savedAttempt.feedback ?? attempt.feedback,
      scorable: attempt.scorable,
      emptyTranscript: attempt.emptyTranscript,
      reason: attempt.reason
    }
  });
}
