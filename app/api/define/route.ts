import { NextResponse } from "next/server";
import { defineWord } from "@/lib/data";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const word = searchParams.get("word")?.toLowerCase().trim();

  if (!word) {
    return NextResponse.json({ error: "Missing word" }, { status: 400 });
  }

  const entry = await defineWord(word);

  if (!entry) {
    return NextResponse.json({
      data: {
        word,
        phonetic: "",
        translation: "暂无释义",
        definition: "本地词典未命中，后续可回退到 AI 语境讲解。"
      }
    });
  }

  return NextResponse.json({ data: entry });
}
