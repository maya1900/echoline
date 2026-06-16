import { NextResponse } from "next/server";
import { normalizeLookupWord } from "@/lib/dictionary/fallback";

const dictionaryApiBaseUrl = "https://api.dictionaryapi.dev/api/v2/entries/en";
const pronunciationCacheSeconds = 60 * 60 * 24 * 30;

type DictionaryApiEntry = {
  phonetics?: Array<{
    audio?: string;
  }>;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const word = normalizeLookupWord(searchParams.get("word") ?? "");

  if (!word || !/^[a-z']{1,48}$/.test(word)) {
    return NextResponse.json({ error: "Missing word" }, { status: 400 });
  }

  const response = await fetch(`${dictionaryApiBaseUrl}/${encodeURIComponent(word)}`, {
    next: { revalidate: pronunciationCacheSeconds }
  }).catch(() => null);

  if (!response?.ok) {
    return NextResponse.json({ data: { word, audioUrl: null } });
  }

  const payload = (await response.json().catch(() => null)) as unknown;
  const audioUrl = findPronunciationAudioUrl(payload);

  return NextResponse.json({ data: { word, audioUrl } });
}

function findPronunciationAudioUrl(payload: unknown) {
  if (!Array.isArray(payload)) {
    return null;
  }

  const audioUrls = payload.flatMap((entry) => {
    if (!isDictionaryApiEntry(entry)) {
      return [];
    }

    return entry.phonetics?.map((phonetic) => normalizeAudioUrl(phonetic.audio)).filter((audioUrl): audioUrl is string => Boolean(audioUrl)) ?? [];
  });

  return audioUrls.find((audioUrl) => /-us\.(mp3|ogg)$/i.test(audioUrl)) ?? audioUrls.find((audioUrl) => /-uk\.(mp3|ogg)$/i.test(audioUrl)) ?? audioUrls[0] ?? null;
}

function isDictionaryApiEntry(value: unknown): value is DictionaryApiEntry {
  return Boolean(value && typeof value === "object" && "phonetics" in value && Array.isArray((value as DictionaryApiEntry).phonetics));
}

function normalizeAudioUrl(audioUrl?: string) {
  if (!audioUrl) {
    return null;
  }

  if (audioUrl.startsWith("//")) {
    return `https:${audioUrl}`;
  }

  return audioUrl.startsWith("http://") || audioUrl.startsWith("https://") ? audioUrl : null;
}
