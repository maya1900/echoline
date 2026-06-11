import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { transcribeRecordingWithDiagnostics } from "@/lib/asr";
import { requireUserRequest } from "@/lib/auth/api";
import { profiles } from "@/lib/db/schema";
import { openSecretValue } from "@/lib/secret-values";
import { defaultAsrModel, readAsrEnvironmentApiKey } from "@/lib/user-settings";

function readAsrProvider(value: unknown) {
  return value === "zhipu" ? "zhipu" : "openai";
}

export async function POST(request: Request) {
  const auth = await requireUserRequest();

  if (auth.error) {
    return auth.error;
  }

  const formData = await request.formData().catch(() => null);

  if (!formData) {
    return NextResponse.json({ error: "请录制一段测试音频后再测试转写" }, { status: 400 });
  }

  const audio = formData.get("audio");
  const provider = readAsrProvider(formData.get("asrProvider"));
  const modelInput = formData.get("asrModel");
  const apiKeyInput = formData.get("asrApiKey");
  const model = typeof modelInput === "string" && modelInput.trim() ? modelInput.trim() : defaultAsrModel(provider);
  const inputApiKey = typeof apiKeyInput === "string" ? apiKeyInput.trim() : "";
  const [currentRow] = await auth.db.select({ asrApiKey: profiles.asrApiKey }).from(profiles).where(eq(profiles.id, auth.user.id)).limit(1);
  const savedApiKey = openSecretValue(currentRow?.asrApiKey);
  const apiKey = inputApiKey || savedApiKey || readAsrEnvironmentApiKey(provider);

  if (!apiKey) {
    return NextResponse.json({ error: "请先填写或配置 ASR API Key" }, { status: 400 });
  }

  if (!(audio instanceof File) || audio.size === 0) {
    return NextResponse.json({ error: "请录制一段测试音频后再测试转写" }, { status: 400 });
  }

  const result = await transcribeRecordingWithDiagnostics({
    file: audio,
    targetText: "This is a transcription test.",
    settings: {
      provider,
      model,
      apiKey,
      enabled: true
    }
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.error ?? "ASR 测试失败",
        data: result
      },
      { status: 400 }
    );
  }

  if (!result.transcript) {
    return NextResponse.json(
      {
        error: "ASR 接口已响应，但没有返回可解析的转写文本。请换一句更清晰的测试录音，或检查模型是否支持当前音频格式。",
        data: result
      },
      { status: 400 }
    );
  }

  return NextResponse.json({
    data: {
      ...result,
      message: "测试转写成功"
    }
  });
}
