import { NextResponse } from "next/server";
import { requireUserRequest } from "@/lib/auth/api";
import { defineWord } from "@/lib/data";

const maxWordLength = 80;
const maxContextLength = 600;

function readContext(value: string | null) {
  const text = value?.trim();

  if (!text) {
    return undefined;
  }

  return text.length <= maxContextLength ? text : text.slice(0, maxContextLength);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const word = searchParams.get("word")?.toLowerCase().trim();
  const englishSentence = readContext(searchParams.get("englishSentence"));
  const chineseSentence = readContext(searchParams.get("chineseSentence"));

  if (!word) {
    return NextResponse.json({ error: "Missing word" }, { status: 400 });
  }

  if (word.length > maxWordLength) {
    return NextResponse.json({ error: "Word is too long" }, { status: 400 });
  }

  const auth = await requireUserRequest();

  if (auth.error) {
    return auth.error;
  }

  const entry = await defineWord(word, { englishSentence, chineseSentence });

  if (!entry) {
    return NextResponse.json({
      data: {
        word,
        phonetic: "",
        translation: "暂无释义",
        definition: englishSentence ?? "",
        inContext: "暂未命中中文释义",
        note: "可先收藏，稍后补充解释。",
        source: "missing"
      }
    });
  }

  return NextResponse.json({ data: entry });
}
