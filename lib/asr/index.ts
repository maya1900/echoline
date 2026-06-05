import { testOpenAiTranscription, transcribeWithOpenAi, type AsrProviderResult } from "@/lib/asr/openai";
import { testZhipuTranscription, transcribeWithZhipu } from "@/lib/asr/zhipu";

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
    if (settings.provider === "zhipu") {
      return transcribeWithZhipu({
        file,
        apiKey: settings.apiKey,
        model: settings.model
      });
    }

    return undefined;
  }

  return transcribeWithOpenAi({
    file,
    prompt: targetText,
    apiKey: settings.apiKey,
    model: settings.model
  });
}

export async function transcribeRecordingWithDiagnostics({ file, targetText, settings }: TranscribeInput): Promise<AsrProviderResult & { provider: string }> {
  if (!file) {
    return { ok: false, provider: settings.provider, error: "Missing audio file" };
  }

  if (!settings.enabled) {
    return { ok: false, provider: settings.provider, error: "ASR is disabled" };
  }

  if (settings.provider === "openai") {
    return {
      provider: settings.provider,
      ...(await testOpenAiTranscription({
        file,
        prompt: targetText,
        apiKey: settings.apiKey,
        model: settings.model
      }))
    };
  }

  if (settings.provider === "zhipu") {
    return {
      provider: settings.provider,
      ...(await testZhipuTranscription({
        file,
        apiKey: settings.apiKey,
        model: settings.model
      }))
    };
  }

  return { ok: false, provider: settings.provider, error: `Unsupported ASR provider: ${settings.provider}` };
}

export function createAsrConnectionTestFile() {
  const sampleRate = 16000;
  const durationSeconds = 0.8;
  const samples = Math.floor(sampleRate * durationSeconds);
  const bytesPerSample = 2;
  const dataBytes = samples * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);
  let offset = 0;

  function writeString(value: string) {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset, value.charCodeAt(index));
      offset += 1;
    }
  }

  writeString("RIFF");
  view.setUint32(offset, 36 + dataBytes, true);
  offset += 4;
  writeString("WAVE");
  writeString("fmt ");
  view.setUint32(offset, 16, true);
  offset += 4;
  view.setUint16(offset, 1, true);
  offset += 2;
  view.setUint16(offset, 1, true);
  offset += 2;
  view.setUint32(offset, sampleRate, true);
  offset += 4;
  view.setUint32(offset, sampleRate * bytesPerSample, true);
  offset += 4;
  view.setUint16(offset, bytesPerSample, true);
  offset += 2;
  view.setUint16(offset, 16, true);
  offset += 2;
  writeString("data");
  view.setUint32(offset, dataBytes, true);
  offset += 4;

  for (let index = 0; index < samples; index += 1) {
    const sample = Math.round(Math.sin((2 * Math.PI * 440 * index) / sampleRate) * 0.08 * 32767);

    view.setInt16(offset, sample, true);
    offset += 2;
  }

  return new File([buffer], "asr-connection-test.wav", { type: "audio/wav" });
}

export async function testAsrConnection(settings: TranscribeInput["settings"]): Promise<AsrProviderResult & { provider: string }> {
  if (!settings.enabled) {
    return { ok: false, provider: settings.provider, error: "ASR is disabled" };
  }

  const file = createAsrConnectionTestFile();

  if (settings.provider === "openai") {
    return {
      provider: settings.provider,
      ...(await testOpenAiTranscription({
        file,
        prompt: "connection test",
        apiKey: settings.apiKey,
        model: settings.model
      }))
    };
  }

  if (settings.provider === "zhipu") {
    return {
      provider: settings.provider,
      ...(await testZhipuTranscription({
        file,
        apiKey: settings.apiKey,
        model: settings.model
      }))
    };
  }

  return { ok: false, provider: settings.provider, error: `Unsupported ASR provider: ${settings.provider}` };
}
