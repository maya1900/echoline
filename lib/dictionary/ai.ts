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
  const enabled = settings.enabled;
  const provider = settings.provider;
  const apiKey = settings.apiKey;
  const model = settings.model || (provider === "siliconflow" ? "THUDM/GLM-4-9B-0414" : "glm-4-flash");
  const baseUrl =
    process.env.DICTIONARY_AI_BASE_URL ??
    (provider === "siliconflow" ? "https://api.siliconflow.cn/v1/chat/completions" : "https://open.bigmodel.cn/api/paas/v4/chat/completions");

  return { apiKey, baseUrl, enabled, model };
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
  const { apiKey, baseUrl, enabled, model } = await getDictionaryAiConfig();

  if (!enabled || !apiKey) {
    return undefined;
  }

  const attemptTimeoutMs = 9000;

  async function requestExplanation(attemptModel: string, useJsonMode: boolean) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), attemptTimeoutMs);
    const response = await fetch(baseUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: attemptModel,
        temperature: 0.1,
        max_tokens: 220,
        ...(useJsonMode ? { response_format: { type: "json_object" } } : {}),
        messages: [
          {
            role: "system",
            content:
              "你是面向中文母语英语学习者的查词助手。只输出紧凑 JSON，不要 Markdown，不要解释推理。字段：translation, partOfSpeech, inContext, note。translation 是当前单词的 1-3 个中文短释义，不要翻译整句；inContext 说明该词在当前字幕里的意思，20 字以内；note 是一句学习提醒，30 字以内。"
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

    clearTimeout(timeout);

    if (!response?.ok) {
      return undefined;
    }

    const payload = (await response.json().catch(() => null)) as { choices?: { message?: { content?: string } }[] } | null;
    const content = payload?.choices?.[0]?.message?.content;
    return content ? parseJsonObject(content) : undefined;
  }

  try {
    for (const useJsonMode of [true, false]) {
      const parsed = await requestExplanation(model, useJsonMode);

      if (parsed?.translation) {
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
      }
    }

    return undefined;
  } catch {
    return undefined;
  }
}
