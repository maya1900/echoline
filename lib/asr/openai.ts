import { describeAsrRequestError, getAsrRequestTimeoutMs } from "@/lib/asr/http";

type TranscribeInput = {
  file: File;
  prompt?: string;
  apiKey: string;
  model: string;
};

type TranscriptionResponse = {
  text?: string;
};

export type AsrProviderResult = {
  ok: boolean;
  transcript?: string;
  error?: string;
  status?: number;
  emptyTranscript?: boolean;
};

async function requestOpenAiTranscription({ file, prompt, apiKey, model }: TranscribeInput): Promise<AsrProviderResult> {
  const baseUrl = process.env.OPENAI_TRANSCRIPTION_BASE_URL ?? "https://api.openai.com/v1/audio/transcriptions";

  if (!apiKey) {
    return { ok: false, error: "Missing OpenAI API key" };
  }

  const formData = new FormData();

  formData.append("file", file, file.name || "recording.webm");
  formData.append("model", model);
  formData.append("response_format", "json");

  if (prompt?.trim()) {
    formData.append("prompt", prompt.trim());
  }

  const response = await fetch(baseUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`
    },
    body: formData,
    signal: AbortSignal.timeout(getAsrRequestTimeoutMs())
  }).catch((error: unknown) => {
    return {
      ok: false,
      status: 0,
      text: async () => describeAsrRequestError(error)
    } as Response;
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");

    return {
      ok: false,
      status: response.status,
      error: errorText || `OpenAI ASR request failed with ${response.status}`
    };
  }

  const payload = (await response.json().catch(() => null)) as TranscriptionResponse | null;
  const transcript = payload?.text?.trim();

  return { ok: true, transcript: transcript || undefined, status: response.status, emptyTranscript: !transcript };
}

export async function transcribeWithOpenAi(input: TranscribeInput) {
  const result = await requestOpenAiTranscription(input);

  return result.ok ? result.transcript : undefined;
}

export async function testOpenAiTranscription(input: TranscribeInput) {
  return requestOpenAiTranscription(input);
}
