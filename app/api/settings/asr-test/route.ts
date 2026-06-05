import { NextResponse } from "next/server";
import { transcribeRecordingWithDiagnostics } from "@/lib/asr";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { defaultAsrModel, readAsrEnvironmentApiKey } from "@/lib/user-settings";

function readAsrProvider(value: unknown) {
  return value === "zhipu" ? "zhipu" : "openai";
}

function isMissingProfileSettingsColumn(error: { message?: string; code?: string } | null | undefined) {
  const message = error?.message?.toLowerCase() ?? "";

  return error?.code === "PGRST204" || (message.includes("schema cache") && message.includes("profiles"));
}

export async function POST(request: Request) {
  const formData = await request.formData().catch(() => null);
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

  if (!formData) {
    return NextResponse.json({ error: "请录制一段测试音频后再测试转写" }, { status: 400 });
  }

  const audio = formData.get("audio");
  const provider = readAsrProvider(formData.get("asrProvider"));
  const modelInput = formData.get("asrModel");
  const apiKeyInput = formData.get("asrApiKey");
  const model = typeof modelInput === "string" && modelInput.trim() ? modelInput.trim() : defaultAsrModel(provider);
  const inputApiKey = typeof apiKeyInput === "string" ? apiKeyInput.trim() : "";
  const { data: currentRow, error: currentRowError } = await supabase.from("profiles").select("asr_api_key").eq("id", user.id).maybeSingle();

  if (!inputApiKey && isMissingProfileSettingsColumn(currentRowError)) {
    return NextResponse.json({ error: "Supabase profiles 表缺少 asr_api_key 字段，请在 SQL Editor 执行 supabase/patch-asr-settings.sql。" }, { status: 500 });
  }

  const savedApiKey = typeof currentRow?.asr_api_key === "string" ? currentRow.asr_api_key.trim() : "";
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
