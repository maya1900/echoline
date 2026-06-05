import type { AsrProviderResult } from "@/lib/asr/openai";

type TranscribeInput = {
  file: File;
  apiKey: string;
  model: string;
};

type ZhipuTranscriptionResponse = {
  text?: string;
  data?: unknown;
  choices?: Array<{
    message?: {
      content?: string;
    };
    delta?: {
      content?: string;
    };
  }>;
};

function readTranscriptFromPayload(payload: ZhipuTranscriptionResponse | null) {
  if (!payload) {
    return undefined;
  }

  const directText = payload.text?.trim();

  if (directText) {
    return directText;
  }

  const choiceText = payload.choices
    ?.map((choice) => choice.message?.content ?? choice.delta?.content ?? "")
    .join("")
    .trim();

  if (choiceText) {
    return choiceText;
  }

  if (typeof payload.data === "string") {
    return payload.data.trim() || undefined;
  }

  if (Array.isArray(payload.data)) {
    const dataText = payload.data
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }

        if (item && typeof item === "object" && "text" in item && typeof item.text === "string") {
          return item.text;
        }

        return "";
      })
      .join("")
      .trim();

    return dataText || undefined;
  }

  return undefined;
}

async function requestZhipuTranscription({ file, apiKey, model }: TranscribeInput): Promise<AsrProviderResult> {
  const baseUrl = process.env.ZHIPU_TRANSCRIPTION_BASE_URL ?? "https://open.bigmodel.cn/api/paas/v4/audio/transcriptions";

  if (!apiKey) {
    return { ok: false, error: "Missing Zhipu API key" };
  }

  const formData = new FormData();

  formData.append("file", file, file.name || "recording.webm");
  formData.append("model", model);
  formData.append("stream", "false");

  const response = await fetch(baseUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`
    },
    body: formData
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");

    return {
      ok: false,
      status: response.status,
      error: errorText || `Zhipu ASR request failed with ${response.status}`
    };
  }

  const payload = (await response.json().catch(() => null)) as ZhipuTranscriptionResponse | null;
  const transcript = readTranscriptFromPayload(payload);

  return { ok: true, transcript: transcript || undefined, status: response.status };
}

export async function transcribeWithZhipu(input: TranscribeInput) {
  const result = await requestZhipuTranscription(input);

  return result.ok ? result.transcript : undefined;
}

export async function testZhipuTranscription(input: TranscribeInput) {
  return requestZhipuTranscription(input);
}
