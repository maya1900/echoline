type TranscribeInput = {
  file: File;
  prompt?: string;
};

type TranscriptionResponse = {
  text?: string;
};

function getOpenAiAsrConfig() {
  return {
    apiKey: process.env.OPENAI_API_KEY ?? "",
    model: process.env.ASR_MODEL ?? "gpt-4o-mini-transcribe",
    baseUrl: process.env.OPENAI_TRANSCRIPTION_BASE_URL ?? "https://api.openai.com/v1/audio/transcriptions"
  };
}

export async function transcribeWithOpenAi({ file, prompt }: TranscribeInput) {
  const { apiKey, baseUrl, model } = getOpenAiAsrConfig();

  if (!apiKey) {
    return undefined;
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
    body: formData
  });

  if (!response.ok) {
    return undefined;
  }

  const payload = (await response.json().catch(() => null)) as TranscriptionResponse | null;
  const transcript = payload?.text?.trim();

  return transcript || undefined;
}
