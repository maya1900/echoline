import type { DictionaryEntry } from "@/lib/types";

const entries: DictionaryEntry[] = [
  { word: "right", phonetic: "/raɪt/", translation: "正确的；右边；立刻；好吧", definition: "We'll be right back." },
  { word: "back", phonetic: "/bæk/", translation: "回来；后面；背部", definition: "We'll be right back." },
  { word: "sure", phonetic: "/ʃʊr/", translation: "确信的；当然", definition: "I'm sure of that." },
  { word: "thank", phonetic: "/θæŋk/", translation: "感谢；谢谢", definition: "Thank you." },
  { word: "look", phonetic: "/lʊk/", translation: "看；寻找；看起来", definition: "You looking for someone?" },
  { word: "looking", phonetic: "/ˈlʊkɪŋ/", translation: "正在看；寻找", definition: "You looking for someone?" },
  { word: "someone", phonetic: "/ˈsʌmwʌn/", translation: "某人；有人", definition: "You looking for someone?" },
  { word: "class", phonetic: "/klæs/", translation: "课堂；班级；类别", definition: "In my class, average actually means average." },
  { word: "average", phonetic: "/ˈævərɪdʒ/", translation: "平均的；普通的", definition: "In my class, average actually means average." },
  { word: "actually", phonetic: "/ˈæktʃuəli/", translation: "实际上；其实", definition: "Average actually means average." },
  { word: "mean", phonetic: "/miːn/", translation: "意思是；意味着；刻薄的", definition: "Average actually means average." },
  { word: "means", phonetic: "/miːnz/", translation: "意思是；意味着", definition: "Average actually means average." },
  { word: "need", phonetic: "/niːd/", translation: "需要", definition: "I need this for my major." },
  { word: "major", phonetic: "/ˈmeɪdʒər/", translation: "专业；主修；重要的", definition: "I need this for my major." },
  { word: "relax", phonetic: "/rɪˈlæks/", translation: "放松；别紧张", definition: "Relax." },
  { word: "respect", phonetic: "/rɪˈspekt/", translation: "尊重；敬重", definition: "He is a talented musician who I respect." },
  { word: "musician", phonetic: "/mjuːˈzɪʃən/", translation: "音乐人；乐手", definition: "He is a talented musician who I respect." },
  { word: "girlfriend", phonetic: "/ˈɡɜːrlfrend/", translation: "女朋友", definition: "She's not my girlfriend." },
  { word: "random", phonetic: "/ˈrændəm/", translation: "随机的；随便的", definition: "He is not just some random guy." },
  { word: "talented", phonetic: "/ˈtæləntɪd/", translation: "有才华的", definition: "He is a talented musician." },
  { word: "song", phonetic: "/sɔːŋ/", translation: "歌曲", definition: "What do you think the song's about?" },
  { word: "love", phonetic: "/lʌv/", translation: "爱；喜欢", definition: "Being in love with someone." },
  { word: "friendship", phonetic: "/ˈfrendʃɪp/", translation: "友谊", definition: "This won't make your friendship weird at all?" },
  { word: "weird", phonetic: "/wɪrd/", translation: "奇怪的；尴尬的", definition: "This won't make your friendship weird at all?" }
];

const dictionary = new Map(entries.map((entry) => [entry.word, entry]));

export function normalizeLookupWord(word: string) {
  return word
    .toLowerCase()
    .replace(/^[^a-z']+|[^a-z']+$/g, "")
    .trim();
}

export function getLookupCandidates(word: string) {
  const normalized = normalizeLookupWord(word);
  const candidates = new Set<string>([normalized]);

  if (normalized.endsWith("'s")) {
    candidates.add(normalized.slice(0, -2));
  }

  if (normalized.endsWith("ies") && normalized.length > 4) {
    candidates.add(`${normalized.slice(0, -3)}y`);
  }

  if (normalized.endsWith("ing") && normalized.length > 5) {
    const stem = normalized.slice(0, -3);
    candidates.add(stem);
    candidates.add(`${stem}e`);
    if (/(.)\1$/.test(stem)) {
      candidates.add(stem.slice(0, -1));
    }
  }

  if (normalized.endsWith("ed") && normalized.length > 4) {
    const stem = normalized.slice(0, -2);
    candidates.add(stem);
    candidates.add(`${stem}e`);
  }

  if (normalized.endsWith("es") && normalized.length > 4) {
    candidates.add(normalized.slice(0, -2));
  }

  if (normalized.endsWith("s") && normalized.length > 3) {
    candidates.add(normalized.slice(0, -1));
  }

  return Array.from(candidates).filter(Boolean);
}

export function lookupFallbackDictionary(word: string) {
  for (const candidate of getLookupCandidates(word)) {
    const entry = dictionary.get(candidate);

    if (entry) {
      return entry;
    }
  }

  return undefined;
}
