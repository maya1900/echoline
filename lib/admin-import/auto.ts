import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { resolveLocalMediaPath } from "@/lib/media/local";
import { parseSubtitleText } from "@/lib/subtitles/parser";

const mediaExtensions = new Set([".mp4", ".webm", ".mov", ".m4v"]);
const subtitleExtensions = new Set([".srt", ".vtt"]);
const maxScanDepth = 3;
const defaultDurationSeconds = 22 * 60;
const defaultCoverUrl = "https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=1200&q=80";
const defaultDifficulty = "B1";
const defaultGenre = "生活 / 情景";

export type AutoImportSeriesFieldSource = "default" | "filename" | "metadata";
export type AutoImportSeriesDraft = {
  title: string;
  originalTitle: string;
  description: string;
  coverUrl: string;
  difficulty: string;
  genre: string;
  status: "draft" | "published";
};

export type AutoImportEpisodeDraft = {
  draftId: string;
  seasonNumber: number;
  episodeNumber: number;
  title: string;
  description: string;
  mediaUrl: string;
  mediaFilename: string;
  mediaPath: string;
  subtitleFilename: string | null;
  subtitlePath: string | null;
  subtitleLineCount: number;
  durationSeconds: number;
  issues: string[];
};

export type AutoImportDraft = {
  directory: string;
  series: AutoImportSeriesDraft;
  seriesFieldSources: Record<keyof AutoImportSeriesDraft, AutoImportSeriesFieldSource>;
  episodes: AutoImportEpisodeDraft[];
  warnings: string[];
};

type FileEntry = {
  filePath: string;
  objectPath: string;
  name: string;
  stem: string;
  extension: string;
  directoryKey: string;
};

type SeriesMetadata = Partial<AutoImportSeriesDraft>;

export class AutoImportError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function scanLocalImportDirectory(input: string): Promise<AutoImportDraft> {
  const directory = normalizeImportDirectory(input);
  const directoryParts = directory.split("/").filter(Boolean);
  const resolved = resolveLocalMediaPath(directoryParts);

  if (!resolved) {
    throw new AutoImportError("目录必须位于 LOCAL_MEDIA_ROOT 内");
  }

  const directoryStat = await stat(/*turbopackIgnore: true*/ resolved.filePath).catch(() => null);

  if (!directoryStat?.isDirectory()) {
    throw new AutoImportError("目录不存在或不可读取", 404);
  }

  const entries = await collectFiles(resolved.root, resolved.filePath);
  const mediaEntries = entries.filter((entry) => mediaExtensions.has(entry.extension)).sort(compareFileEntries);
  const subtitleEntries = entries.filter((entry) => subtitleExtensions.has(entry.extension));
  const subtitlesByStem = new Map(subtitleEntries.map((entry) => [`${entry.directoryKey}/${entry.stem.toLowerCase()}`, entry]));
  const metadata = await readSeriesMetadata(resolved.filePath);
  const seriesTitle = metadata.title || inferSeriesTitle(path.basename(resolved.filePath));
  const defaultSeasonNumber = inferSeasonNumber(`${directory} ${path.basename(resolved.filePath)}`);
  const episodes = await Promise.all(
    mediaEntries.map(async (entry, index) => {
      const identity = inferEpisodeIdentity(entry.stem, index + 1, defaultSeasonNumber);
      const subtitleEntry = subtitlesByStem.get(`${entry.directoryKey}/${entry.stem.toLowerCase()}`) ?? null;
      const parsedLines = subtitleEntry ? parseSubtitleText(await readFile(/*turbopackIgnore: true*/ subtitleEntry.filePath, "utf8").catch(() => "")) : [];
      const durationSeconds = parsedLines.at(-1)?.endMs ? Math.max(1, Math.ceil(parsedLines.at(-1)!.endMs / 1000)) : defaultDurationSeconds;
      const title = inferEpisodeTitle(entry.stem, seriesTitle, identity) || `第 ${identity.episodeNumber} 集`;
      const issues = [
        !subtitleEntry ? "未找到同名字幕" : "",
        subtitleEntry && parsedLines.length === 0 ? "字幕未解析出句子" : ""
      ].filter(Boolean);

      return {
        draftId: `${identity.seasonNumber}-${identity.episodeNumber}-${entry.stem}`,
        seasonNumber: identity.seasonNumber,
        episodeNumber: identity.episodeNumber,
        title,
        description: `自动识别媒体文件 ${entry.name}${subtitleEntry ? `，匹配字幕 ${subtitleEntry.name}` : ""}。`,
        mediaUrl: `local/${entry.objectPath}`,
        mediaFilename: entry.name,
        mediaPath: entry.objectPath,
        subtitleFilename: subtitleEntry?.name ?? null,
        subtitlePath: subtitleEntry?.objectPath ?? null,
        subtitleLineCount: parsedLines.length,
        durationSeconds,
        issues
      };
    })
  );
  const sortedEpisodes = normalizeSegmentedEpisodeGroup(
    episodes.sort((left, right) => left.seasonNumber - right.seasonNumber || left.episodeNumber - right.episodeNumber || left.mediaPath.localeCompare(right.mediaPath, "zh-CN"))
  );
  const warnings = getScanWarnings(sortedEpisodes);

  if (sortedEpisodes.length === 0) {
    warnings.push("没有找到可导入的视频文件");
  }

  return {
    directory,
    series: {
      title: seriesTitle,
      originalTitle: metadata.originalTitle || seriesTitle,
      description: metadata.description || `${seriesTitle} 自动导入的个人学习资料，共 ${sortedEpisodes.length} 集。`,
      coverUrl: metadata.coverUrl || defaultCoverUrl,
      difficulty: metadata.difficulty || defaultDifficulty,
      genre: metadata.genre || defaultGenre,
      status: metadata.status === "draft" ? "draft" : "published"
    },
    seriesFieldSources: {
      title: metadata.title ? "metadata" : "filename",
      originalTitle: metadata.originalTitle ? "metadata" : metadata.title ? "metadata" : "filename",
      description: metadata.description ? "metadata" : "default",
      coverUrl: metadata.coverUrl ? "metadata" : "default",
      difficulty: metadata.difficulty ? "metadata" : "default",
      genre: metadata.genre ? "metadata" : "default",
      status: metadata.status ? "metadata" : "default"
    },
    episodes: sortedEpisodes,
    warnings
  };
}

function normalizeImportDirectory(input: string) {
  const normalized = input.trim().replace(/^local\//, "").replace(/^\/+/, "").replace(/\/+$/, "");

  if (!normalized) {
    throw new AutoImportError("请填写 LOCAL_MEDIA_ROOT 下的相对目录");
  }

  if (/[\x00-\x1F\x7F\\]/.test(normalized)) {
    throw new AutoImportError("目录包含非法字符");
  }

  const parts = normalized.split("/");

  if (parts.some((part) => !part || part === "." || part === "..")) {
    throw new AutoImportError("目录不能包含 . 或 ..");
  }

  return parts.join("/");
}

async function collectFiles(root: string, directory: string, depth = 0): Promise<FileEntry[]> {
  if (depth > maxScanDepth) {
    return [];
  }

  const dirents = await readdir(/*turbopackIgnore: true*/ directory, { withFileTypes: true }).catch(() => []);
  const nested = await Promise.all(
    dirents.map(async (dirent) => {
      const filePath = path.join(/*turbopackIgnore: true*/ directory, dirent.name);

      if (dirent.isDirectory()) {
        return collectFiles(root, filePath, depth + 1);
      }

      if (!dirent.isFile()) {
        return [];
      }

      const extension = path.extname(dirent.name).toLowerCase();

      if (!mediaExtensions.has(extension) && !subtitleExtensions.has(extension)) {
        return [];
      }

      const objectPath = toObjectPath(path.relative(/*turbopackIgnore: true*/ root, filePath));
      const directoryKey = toObjectPath(path.dirname(objectPath));

      return [
        {
          filePath,
          objectPath,
          name: dirent.name,
          stem: path.basename(dirent.name, extension),
          extension,
          directoryKey
        }
      ];
    })
  );

  return nested.flat();
}

async function readSeriesMetadata(directory: string): Promise<SeriesMetadata> {
  const candidates = ["metadata.json", "series.json", "info.json"];

  for (const candidate of candidates) {
    const filePath = path.join(/*turbopackIgnore: true*/ directory, candidate);
    const payload = await readFile(/*turbopackIgnore: true*/ filePath, "utf8")
      .then((text) => sanitizeSeriesMetadata(JSON.parse(text)))
      .catch(() => null);

    if (payload && typeof payload === "object") {
      return payload;
    }
  }

  return {};
}

function sanitizeSeriesMetadata(value: unknown): SeriesMetadata {
  if (!value || typeof value !== "object") {
    return {};
  }

  const record = value as Record<string, unknown>;

  return {
    title: readMetadataString(record.title),
    originalTitle: readMetadataString(record.originalTitle),
    description: readMetadataString(record.description),
    coverUrl: readMetadataString(record.coverUrl),
    difficulty: readMetadataString(record.difficulty),
    genre: readMetadataString(record.genre),
    status: record.status === "draft" || record.status === "published" ? record.status : undefined
  };
}

function readMetadataString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function compareFileEntries(left: FileEntry, right: FileEntry) {
  const leftIdentity = inferEpisodeIdentity(left.stem, 0, inferSeasonNumber(left.objectPath));
  const rightIdentity = inferEpisodeIdentity(right.stem, 0, inferSeasonNumber(right.objectPath));

  return leftIdentity.seasonNumber - rightIdentity.seasonNumber || leftIdentity.episodeNumber - rightIdentity.episodeNumber || left.objectPath.localeCompare(right.objectPath, "zh-CN");
}

function inferSeriesTitle(value: string) {
  const cleaned = humanizeName(value)
    .replace(/第\s*[一二三四五六七八九十百\d]+\s*季.*$/i, "")
    .replace(/\bseason\s*\d+.*$/i, "")
    .replace(/\bs\d{1,2}\b.*$/i, "")
    .replace(/第\s*[一二三四五六七八九十百\d]+\s*[集话].*$/i, "")
    .replace(/\b(ep|episode|e)\s*\d{1,3}\b.*$/i, "")
    .replace(/\bmp4\b/gi, "")
    .trim();

  return cleaned || humanizeName(value) || "未命名剧集";
}

function inferEpisodeIdentity(stem: string, fallbackEpisode: number, defaultSeasonNumber: number) {
  const normalized = stem.replace(/[._-]+/g, " ");
  const seasonEpisodeMatch =
    normalized.match(/\bs(?:eason)?\s*(\d{1,2})\s*e(?:p(?:isode)?)?\s*(\d{1,3})\b/i) ??
    normalized.match(/\bseason\s*(\d{1,2}).*?\bepisode\s*(\d{1,3})\b/i);
  const chineseEpisodeMatch = normalized.match(/第\s*([一二三四五六七八九十百\d]+)\s*[集话]/);
  const episodeMatch = normalized.match(/\b(?:ep|episode|e)\s*(\d{1,3})\b/i);
  const trailingNumberMatch = normalized.match(/(?:^|\s)(\d{1,3})$/);
  const seasonNumber = seasonEpisodeMatch?.[1] ? Number(seasonEpisodeMatch[1]) : inferSeasonNumber(stem, defaultSeasonNumber);
  const episodeNumber =
    readEpisodeNumber(seasonEpisodeMatch?.[2]) ??
    readEpisodeNumber(chineseEpisodeMatch?.[1]) ??
    readEpisodeNumber(episodeMatch?.[1]) ??
    readEpisodeNumber(trailingNumberMatch?.[1]) ??
    fallbackEpisode;

  return {
    seasonNumber: Number.isInteger(seasonNumber) && seasonNumber > 0 ? seasonNumber : defaultSeasonNumber,
    episodeNumber
  };
}

function inferSeasonNumber(value: string, fallback = 1) {
  const normalized = value.replace(/[._-]+/g, " ");
  const match = normalized.match(/\bs(?:eason)?\s*(\d{1,2})\b/i) ?? normalized.match(/第\s*([一二三四五六七八九十百\d]+)\s*季/i);
  const seasonNumber = readEpisodeNumber(match?.[1]);

  return seasonNumber ?? fallback;
}

function readEpisodeNumber(value?: string) {
  if (!value) {
    return undefined;
  }

  const numeric = Number(value);

  if (Number.isInteger(numeric) && numeric > 0) {
    return numeric;
  }

  return parseChineseNumber(value);
}

function parseChineseNumber(value: string) {
  const digits: Record<string, number> = {
    零: 0,
    一: 1,
    二: 2,
    两: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9
  };

  if (value === "十") {
    return 10;
  }

  if (value.includes("十")) {
    const [left, right] = value.split("十");
    const tens = left ? digits[left] ?? 0 : 1;
    const ones = right ? digits[right] ?? 0 : 0;
    return tens * 10 + ones;
  }

  return digits[value];
}

function inferEpisodeTitle(stem: string, seriesTitle: string, identity: { seasonNumber: number; episodeNumber: number }) {
  const season = String(identity.seasonNumber).padStart(2, "0");
  const episode = String(identity.episodeNumber).padStart(2, "0");
  const cleaned = humanizeName(stem)
    .replace(seriesTitle, "")
    .replace(new RegExp(`\\bs\\s*${season}\\s*e\\s*${episode}\\b`, "i"), "")
    .replace(new RegExp(`\\bs\\s*${identity.seasonNumber}\\s*e\\s*${identity.episodeNumber}\\b`, "i"), "")
    .replace(/第\s*[一二三四五六七八九十百\d]+\s*季/i, "")
    .replace(/\bseason\s*\d{1,2}\b/i, "")
    .replace(/\bepisode\s*\d{1,3}\b/i, "")
    .replace(/\bep\s*\d{1,3}\b/i, "")
    .replace(/\be\s*\d{1,3}\b/i, "")
    .replace(/第\s*[一二三四五六七八九十百\d]+\s*[集话]/i, "")
    .replace(/\s+/g, " ")
    .trim();

  return /^\d{1,3}$/.test(cleaned) ? "" : cleaned;
}

function humanizeName(value: string) {
  return value
    .replace(/\[[^\]]+\]|\([^)]+\)/g, " ")
    .replace(/[._-]+/g, " ")
    .replace(/\b(2160p|1080p|720p|480p|x264|x265|h264|h265|web dl|webrip|bluray|bdrip|hdrip|aac|ddp?\d?|mp4|mkv|webm|mov|m4v)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getScanWarnings(episodes: AutoImportEpisodeDraft[]) {
  const warnings = new Set<string>();
  const keys = new Set<string>();

  for (const episode of episodes) {
    const key = `${episode.seasonNumber}-${episode.episodeNumber}`;

    if (keys.has(key)) {
      warnings.add(`S${episode.seasonNumber}E${episode.episodeNumber} 出现重复集号`);
    }

    keys.add(key);

    for (const issue of episode.issues) {
      warnings.add(issue);
    }
  }

  return Array.from(warnings);
}

function normalizeSegmentedEpisodeGroup(episodes: AutoImportEpisodeDraft[]) {
  if (episodes.length < 2) {
    return episodes;
  }

  const identityKeys = new Set(episodes.map((episode) => `${episode.seasonNumber}-${episode.episodeNumber}`));

  if (identityKeys.size !== 1) {
    return episodes;
  }

  const keyedEpisodes = episodes.map((episode) => ({
    episode,
    trailingSequence: readTrailingSequence(episode.mediaFilename)
  }));

  if (keyedEpisodes.some((entry) => entry.trailingSequence === undefined)) {
    return episodes;
  }

  const sequenceKeys = new Set(keyedEpisodes.map((entry) => entry.trailingSequence));

  if (sequenceKeys.size !== keyedEpisodes.length) {
    return episodes;
  }

  return keyedEpisodes
    .sort((left, right) => left.trailingSequence! - right.trailingSequence! || left.episode.mediaPath.localeCompare(right.episode.mediaPath, "zh-CN"))
    .map(({ episode }, index) => {
      const episodeNumber = index + 1;

      return {
        ...episode,
        draftId: `${episode.seasonNumber}-${episodeNumber}-${episode.mediaPath}`,
        episodeNumber,
        title: isGenericEpisodeTitle(episode.title) ? `第 ${episodeNumber} 集` : episode.title
      };
    });
}

function readTrailingSequence(filename: string) {
  const stem = path.basename(filename, path.extname(filename));
  const normalized = stem.replace(/[._-]+/g, " ").trim();
  const match = normalized.match(/(?:^|\s)(\d{1,3})$/);
  const value = match?.[1] ? Number(match[1]) : Number.NaN;

  return Number.isInteger(value) && value >= 0 ? value : undefined;
}

function isGenericEpisodeTitle(value: string) {
  return /^第\s*\d+\s*集$/.test(value.trim());
}

function toObjectPath(value: string) {
  return value.split(path.sep).join("/");
}
