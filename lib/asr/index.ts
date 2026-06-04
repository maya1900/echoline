import { transcribeWithOpenAi } from "@/lib/asr/openai";

type TranscribeInput = {
  file?: File;
  targetText?: string;
};

export async function transcribeRecording({ file, targetText }: TranscribeInput) {
  if (!file) {
    return undefined;
  }

  const provider = process.env.ASR_PROVIDER ?? "openai";

  if (provider !== "openai") {
    return undefined;
  }

  return transcribeWithOpenAi({
    file,
    prompt: targetText
  });
}
