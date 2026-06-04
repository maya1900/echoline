import { getDictionaryAiSettings } from "@/lib/admin-data";
import type { DictionaryEntry } from "@/lib/types";

type ExplainInput = {
  word: string;
  englishSentence?: string;
  chineseSentence?: string;
};

type ExplainResponse = {
  translation?: string;
  partOfSpeech?: string;
  inContext?: string;
  note?: string;
};

async function getDictionaryAiConfig() {
  const settings = await getDictionaryAiSettings();
  const provider = settings.provider;
  const apiKey = settings.apiKey;
  const model = settings.model || (provider === "siliconflow" ? "THUDM/GLM-4-9B-0414" : "glm-4-flash");
  const baseUrl =
    process.env.DICTIONARY_AI_BASE_URL ??
    (provider === "siliconflow" ? "https://api.siliconflow.cn/v1/chat/completions" : "https://open.bigmodel.cn/api/paas/v4/chat/completions");

  return { apiKey, baseUrl, model };
}

function parseJsonObject(content: string): ExplainResponse | undefined {
  const cleaned = content.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const match = cleaned.match(/\{[\s\S]*\}/);

  if (!match) {
    return undefined;
  }

  try {
    return JSON.parse(match[0]) as ExplainResponse;
  } catch {
    return undefined;
  }
}

export async function explainWordInChinese(input: ExplainInput): Promise<DictionaryEntry | undefined> {
  const { apiKey, baseUrl, model } = await getDictionaryAiConfig();

  if (!apiKey) {
    return undefined;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  async function requestExplanation(useJsonMode: boolean) {
    const response = await fetch(baseUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        ...(useJsonMode ? { response_format: { type: "json_object" } } : {}),
        messages: [
          {
            role: "system",
            content:
              "你是面向中文母语英语学习者的查词助手。只输出 JSON，不要 Markdown。字段：translation, partOfSpeech, inContext, note。translation 是 1-3 个中文短释义；inContext 说明该词在当前字幕里的意思，20 字以内；note 是一句学习提醒，30 字以内。"
          },
          {
            role: "user",
            content: JSON.stringify({
              word: input.word,
              englishSentence: input.englishSentence ?? "",
              chineseSentence: input.chineseSentence ?? ""
            })
          }
        ]
      }),
      signal: controller.signal
    }).catch(() => null);

    if (!response?.ok) {
      return undefined;
    }

    const payload = (await response.json().catch(() => null)) as { choices?: { message?: { content?: string } }[] } | null;
    const content = payload?.choices?.[0]?.message?.content;
    return content ? parseJsonObject(content) : undefined;
  }

  try {
    const parsed = (await requestExplanation(true)) ?? (await requestExplanation(false));

    if (!parsed?.translation) {
      return undefined;
    }

    return {
      word: input.word,
      phonetic: "",
      translation: parsed.translation,
      definition: input.englishSentence ?? "",
      partOfSpeech: parsed.partOfSpeech,
      inContext: parsed.inContext,
      note: parsed.note,
      source: "ai"
    };
  } finally {
    clearTimeout(timeout);
  }
}
