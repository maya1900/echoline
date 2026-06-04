import { transcribeWithOpenAi } from "@/lib/asr/openai";

type TranscribeInput = {
  file?: File;
  targetText?: string;
  settings: {
    provider: string;
    model: string;
    apiKey: string;
    enabled: boolean;
  };
};

export async function transcribeRecording({ file, targetText, settings }: TranscribeInput) {
  if (!file || !settings.enabled) {
    return undefined;
  }

  if (settings.provider !== "openai") {
    return undefined;
  }

  return transcribeWithOpenAi({
    file,
    prompt: targetText,
    apiKey: settings.apiKey,
    model: settings.model
  });
}
