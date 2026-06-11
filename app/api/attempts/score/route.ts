import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { transcribeRecordingWithDiagnostics } from "@/lib/asr";
import { requireUserRequest } from "@/lib/auth/api";
import { repeatAttempts, subtitleLines } from "@/lib/db/schema";
import { resolveLocalMediaPath } from "@/lib/media/local";
import { scoreRepeatAttempt } from "@/lib/scoring/text";
import { getAsrSettingsForUser } from "@/lib/user-settings";

const allowedModes = new Set(["repeat", "call_response"]);
const maxRecordingBytes = 15 * 1024 * 1024;
const maxScoreRequestBytes = maxRecordingBytes + 1024 * 1024;

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

async function saveRecording(input: ScoreInput, userId: string) {
  if (!input.audioFile) {
    return input.audioUrl || null;
  }

  if (input.audioFile.size > maxRecordingBytes) {
    throw new Error("Recording is too large");
  }

  const objectPath = path.join(
    "recordings",
    userId,
    input.episodeId,
    input.subtitleLineId,
    `${Date.now()}-${crypto.randomUUID()}.${extensionForAudio(input.audioFile)}`
  );
  const resolved = resolveLocalMediaPath(objectPath.split(path.sep));

  if (!resolved) {
    throw new Error("Invalid recording path");
  }

  await mkdir(path.dirname(resolved.filePath), { recursive: true });
  await writeFile(resolved.filePath, Buffer.from(await input.audioFile.arrayBuffer()), { flag: "wx" });

  return `local/${objectPath}`;
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
  const auth = await requireUserRequest();

  if (auth.error) {
    return auth.error;
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);

  if (Number.isFinite(contentLength) && contentLength > maxScoreRequestBytes) {
    return NextResponse.json({ error: "Recording is too large" }, { status: 413 });
  }

  const input = await readScoreInput(request);

  if (!input.episodeId || !input.subtitleLineId || !input.targetText.trim()) {
    return NextResponse.json({ error: "Missing scoring input" }, { status: 400 });
  }

  if (input.transcript.trim()) {
    return NextResponse.json({ error: "Transcript input is not accepted for scored attempts" }, { status: 400 });
  }

  const [subtitleLine] = await auth.db
    .select({ englishText: subtitleLines.englishText })
    .from(subtitleLines)
    .where(and(eq(subtitleLines.episodeId, input.episodeId), eq(subtitleLines.id, input.subtitleLineId)))
    .limit(1);

  if (!subtitleLine) {
    return NextResponse.json({ error: "Subtitle line not found" }, { status: 404 });
  }

  const targetText = typeof subtitleLine.englishText === "string" ? subtitleLine.englishText : "";

  if (!targetText.trim()) {
    return NextResponse.json({ error: "Subtitle line has no English text" }, { status: 400 });
  }

  if (input.targetText.trim() !== targetText.trim()) {
    return NextResponse.json({ error: "Target text does not match subtitle line" }, { status: 409 });
  }

  const mode = (allowedModes.has(input.mode) ? input.mode : "repeat") as "repeat" | "call_response";
  const asrSettings = await getAsrSettingsForUser(auth.user.id);
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
    audioUrl = await saveRecording(input, auth.user.id);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to save recording" }, { status: 500 });
  }

  const [savedAttempt] = await auth.db
    .insert(repeatAttempts)
    .values({
      userId: auth.user.id,
      episodeId: input.episodeId,
      subtitleLineId: input.subtitleLineId,
      mode,
      targetText,
      transcript: attempt.transcript,
      audioUrl,
      accuracy: attempt.accuracy,
      completeness: attempt.completeness,
      fluency: null,
      overall: attempt.overall,
      feedback: attempt.feedback
    })
    .returning({
      transcript: repeatAttempts.transcript,
      accuracy: repeatAttempts.accuracy,
      completeness: repeatAttempts.completeness,
      overall: repeatAttempts.overall,
      feedback: repeatAttempts.feedback
    });

  if (!savedAttempt) {
    return NextResponse.json({ error: "Failed to save repeat attempt" }, { status: 500 });
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
