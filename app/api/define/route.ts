import { NextResponse } from "next/server";
import { defineWord } from "@/lib/data";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const word = searchParams.get("word")?.toLowerCase().trim();
  const englishSentence = searchParams.get("englishSentence")?.trim();
  const chineseSentence = searchParams.get("chineseSentence")?.trim();

  if (!word) {
    return NextResponse.json({ error: "Missing word" }, { status: 400 });
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
