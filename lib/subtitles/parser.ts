export type ParsedSubtitleLine = {
  lineIndex: number;
  startMs: number;
  endMs: number;
  englishText: string;
  chineseText: string;
  keywords: string[];
};

const timeRangePattern = /(\d{1,2}:\d{2}:\d{2}[,.]\d{1,3}|\d{1,2}:\d{2}[,.]\d{1,3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[,.]\d{1,3}|\d{1,2}:\d{2}[,.]\d{1,3})/;
const latinPattern = /[A-Za-z]/;
const chinesePattern = /[\u3400-\u9fff]/;

export function parseSubtitleText(input: string): ParsedSubtitleLine[] {
  const normalized = input.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const blocks = normalized
    .replace(/^WEBVTT[\s\S]*?(?:\n\n|$)/, "")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  return blocks.flatMap((block, blockIndex) => parseBlock(block, blockIndex + 1)).map((line, index) => ({ ...line, lineIndex: index + 1 }));
}

function parseBlock(block: string, fallbackIndex: number): ParsedSubtitleLine[] {
  const rows = block
    .split("\n")
    .map((row) => row.trim())
    .filter(Boolean);
  const timingIndex = rows.findIndex((row) => timeRangePattern.test(row));

  if (timingIndex === -1) {
    return [];
  }

  const match = rows[timingIndex].match(timeRangePattern);

  if (!match?.[1] || !match?.[2]) {
    return [];
  }

  const textRows = rows.slice(timingIndex + 1).map(stripCueMarkup).filter(Boolean);
  const { englishText, chineseText } = splitBilingualText(textRows);

  if (!englishText) {
    return [];
  }

  return [
    {
      lineIndex: fallbackIndex,
      startMs: parseTimestamp(match[1]),
      endMs: parseTimestamp(match[2]),
      englishText,
      chineseText,
      keywords: extractKeywords(englishText)
    }
  ];
}

function parseTimestamp(value: string) {
  const normalized = value.replace(",", ".");
  const parts = normalized.split(":");
  const seconds = Number(parts.pop() ?? 0);
  const minutes = Number(parts.pop() ?? 0);
  const hours = Number(parts.pop() ?? 0);

  return Math.round(((hours * 60 + minutes) * 60 + seconds) * 1000);
}

function stripCueMarkup(value: string) {
  return value.replace(/<[^>]+>/g, "").replace(/\{[^}]+\}/g, "").trim();
}

function splitBilingualText(rows: string[]) {
  const chineseRows = rows.filter((row) => chinesePattern.test(row));
  const englishRows = rows.filter((row) => latinPattern.test(row) && !chinesePattern.test(row));

  return {
    englishText: englishRows.join(" ").replace(/\s+/g, " ").trim(),
    chineseText: chineseRows.join(" ").replace(/\s+/g, " ").trim()
  };
}

function extractKeywords(text: string) {
  const stopWords = new Set(["a", "an", "and", "are", "but", "for", "i", "in", "is", "it", "me", "of", "on", "or", "the", "to", "was", "we", "you"]);
  const words = text
    .toLowerCase()
    .match(/[a-z']+/g)
    ?.map((word) => word.replace(/^'+|'+$/g, ""))
    .filter((word) => word.length > 3 && !stopWords.has(word));

  return Array.from(new Set(words ?? [])).slice(0, 6);
}
