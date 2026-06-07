"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BookOpenCheck,
  Copy,
  Database,
  Pencil,
  FileUp,
  Film,
  FolderInput,
  KeyRound,
  ListChecks,
  Lock,
  Plus,
  Save,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Server,
  Trash2,
  UserCog,
  Users,
  X
} from "lucide-react";
import type { AdminImportJob, AdminUser, Episode, Series, SiteSettings, SubtitleLine } from "@/lib/types";
import { cn } from "@/lib/utils";

type SeriesResponse = {
  id: string;
  title: string;
  originalTitle?: string;
  original_title?: string | null;
  description?: string | null;
  coverUrl?: string;
  cover_url?: string | null;
  difficulty?: string;
  genre?: string | null;
};

type EpisodeResponse = {
  id: string;
  seriesId?: string;
  series_id?: string;
  seasonNumber?: number;
  season_number?: number;
  episodeNumber?: number;
  episode_number?: number;
  title: string;
  description?: string | null;
  mediaUrl?: string;
  media_url?: string | null;
  durationSeconds?: number;
  duration_seconds?: number | null;
  progress?: number;
};

type MediaUploadResponse = {
  mediaUrl?: string;
};

type ImportResponse = {
  id?: string;
  title?: string;
  status?: AdminImportJob["status"];
  result?: string;
  job?: {
    id: string;
    source_filename: string | null;
    status: string;
    parsed_lines: number;
    error_message: string | null;
    created_at: string;
  };
  lines?: unknown[];
};

type SubtitleLineResponse = {
  id: string;
  episode_id?: string;
  episodeId?: string;
  line_index?: number;
  lineIndex?: number;
  start_ms?: number;
  startMs?: number;
  end_ms?: number;
  endMs?: number;
  english_text?: string;
  englishText?: string;
  chinese_text?: string | null;
  chineseText?: string | null;
  difficulty?: string | null;
  keywords?: string[] | null;
};

type AutoImportEpisodeDraft = {
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

type AutoImportSeriesFieldSource = "default" | "filename" | "metadata";

type AutoImportSeriesDraft = {
  title: string;
  originalTitle: string;
  description: string;
  coverUrl: string;
  difficulty: string;
  genre: string;
  status: "draft" | "published";
};

type AutoImportDraft = {
  directory: string;
  series: AutoImportSeriesDraft;
  seriesFieldSources?: Partial<Record<keyof AutoImportSeriesDraft, AutoImportSeriesFieldSource>>;
  episodes: AutoImportEpisodeDraft[];
  warnings: string[];
};

type AutoImportResult = {
  series: Series;
  jobs: AdminImportJob[];
};

type AdminModule = "imports" | "users" | "permissions" | "settings";
type ImportPanel = "auto" | "series" | "episode" | "subtitles" | "editor";
type MediaSource = "local" | "url" | "mock";

const statusText = {
  queued: "排队中",
  processing: "处理中",
  completed: "已完成",
  failed: "失败"
};

const defaultCoverUrl = "https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=1200&q=80";
const difficultyOptions = ["A1", "A2", "B1", "B2", "C1", "C2"];
const genreOptions = ["生活 / 情景", "校园", "职场", "家庭", "旅行", "喜剧", "纪录片"];
const dictionaryProviderOptions = ["bigmodel", "siliconflow"];
const mediaSources: Array<{ id: MediaSource; label: string; hint: string }> = [
  { id: "local", label: "服务器本地", hint: "local/series/s01e01.mp4" },
  { id: "url", label: "外部 URL", hint: "https://example.com/video.mp4" },
  { id: "mock", label: "Mock", hint: "/api/mock-media/campus/s01e01.mp4" }
];

export function AdminWorkbench({
  initialSeries,
  initialJobs,
  initialUsers,
  initialSettings
}: {
  initialSeries: Series[];
  initialJobs: AdminImportJob[];
  initialUsers: AdminUser[];
  initialSettings: SiteSettings;
}) {
  const [series, setSeries] = useState(initialSeries);
  const [jobs, setJobs] = useState(initialJobs);
  const [users, setUsers] = useState(initialUsers);
  const [settings, setSettings] = useState(initialSettings);
  const [activeModule, setActiveModule] = useState<AdminModule>("imports");
  const [activePanel, setActivePanel] = useState<ImportPanel>("series");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savingUserId, setSavingUserId] = useState("");
  const [dictionaryApiKeyInput, setDictionaryApiKeyInput] = useState("");
  const [mediaUpload, setMediaUpload] = useState({ isUploading: false, error: "", fileName: "" });
  const [autoImportDirectory, setAutoImportDirectory] = useState("");
  const [autoImportDraft, setAutoImportDraft] = useState<AutoImportDraft | null>(null);
  const [autoImportMode, setAutoImportMode] = useState<"idle" | "scanning" | "importing">("idle");
  const [editingSeriesId, setEditingSeriesId] = useState("");
  const [editingEpisodeId, setEditingEpisodeId] = useState("");
  const [savingContentId, setSavingContentId] = useState("");
  const [deletingContentId, setDeletingContentId] = useState("");

  const [seriesForm, setSeriesForm] = useState({
    title: "",
    originalTitle: "",
    description: "",
    coverUrl: "",
    difficulty: "B1",
    genre: "生活 / 情景",
    status: "published"
  });
  const [episodeForm, setEpisodeForm] = useState({
    seriesId: initialSeries[0]?.id ?? "",
    seasonNumber: 1,
    episodeNumber: nextEpisodeNumber(initialSeries[0]),
    title: "",
    description: "",
    mediaSource: "local" as MediaSource,
    mediaUrl: "",
    durationMinutes: 22,
    status: "published"
  });
  const [subtitleForm, setSubtitleForm] = useState({
    episodeId: initialSeries[0]?.episodes[0]?.id ?? "",
    sourceFilename: "episode.srt",
    subtitleText: ""
  });
  const [editorEpisodeId, setEditorEpisodeId] = useState(initialSeries[0]?.episodes[0]?.id ?? "");
  const [subtitleLines, setSubtitleLines] = useState<SubtitleLine[]>([]);
  const [selectedLineId, setSelectedLineId] = useState("");
  const [lineForm, setLineForm] = useState({
    englishText: "",
    chineseText: "",
    startMs: 0,
    endMs: 0,
    difficulty: "B1",
    keywords: ""
  });
  const [seriesEditForm, setSeriesEditForm] = useState({
    title: "",
    originalTitle: "",
    description: "",
    coverUrl: "",
    difficulty: "B1",
    genre: ""
  });
  const [episodeEditForm, setEpisodeEditForm] = useState({
    seasonNumber: 1,
    episodeNumber: 1,
    title: "",
    description: "",
    mediaUrl: "",
    durationMinutes: 22
  });

  const episodes = useMemo(() => series.flatMap((item) => item.episodes.map((episode) => ({ ...episode, seriesTitle: item.title }))), [series]);
  const totalEpisodes = episodes.length;
  const adminCount = users.filter((user) => user.role === "admin").length;
  const latestJob = jobs[0];

  function updateEpisodeSeries(seriesId: string) {
    const targetSeries = series.find((item) => item.id === seriesId);
    setEpisodeForm((current) => ({
      ...current,
      seriesId,
      episodeNumber: nextEpisodeNumber(targetSeries)
    }));
  }

  async function scanAutoImportDirectory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!autoImportDirectory.trim()) {
      setMessage("请填写媒体目录");
      return;
    }

    setAutoImportMode("scanning");
    setMessage("扫描媒体目录中");
    const response = await postJsonWithError<AutoImportDraft>("/api/admin/import-batch", {
      action: "scan",
      directory: autoImportDirectory
    });

    if (response.data) {
      setAutoImportDraft(response.data);
      setAutoImportDirectory(response.data.directory);
      setMessage(`识别到 ${response.data.episodes.length} 集，确认后导入`);
    } else {
      setAutoImportDraft(null);
      setMessage(response.error ?? "目录扫描失败");
    }

    setAutoImportMode("idle");
  }

  async function confirmAutoImport() {
    if (!autoImportDraft) {
      return;
    }

    setAutoImportMode("importing");
    setMessage("确认导入中");
    const response = await postJsonWithError<AutoImportResult>("/api/admin/import-batch", {
      action: "import",
      directory: autoImportDraft.directory,
      series: autoImportDraft.series
    });

    if (response.data) {
      const importedSeries = response.data.series;
      const firstEpisode = importedSeries.episodes[0];

      setSeries((current) => [importedSeries, ...current]);
      setJobs((current) => [...response.data!.jobs, ...current]);
      setAutoImportDraft(null);
      setEpisodeForm((current) => ({
        ...current,
        seriesId: importedSeries.id,
        episodeNumber: importedSeries.episodes.length + 1
      }));

      if (firstEpisode) {
        setSubtitleForm((current) => ({ ...current, episodeId: firstEpisode.id }));
        setEditorEpisodeId(firstEpisode.id);
        setActivePanel("editor");
        await loadSubtitleLines(firstEpisode.id);
      }

      setMessage(`已导入 ${importedSeries.title}，共 ${importedSeries.episodes.length} 集`);
    } else {
      setMessage(response.error ?? "自动导入失败");
    }

    setAutoImportMode("idle");
  }

  function updateAutoImportSeries<K extends keyof AutoImportSeriesDraft>(key: K, value: AutoImportSeriesDraft[K]) {
    setAutoImportDraft((current) =>
      current
        ? {
            ...current,
            series: {
              ...current.series,
              [key]: value
            }
          }
        : current
    );
  }

  function beginEditSeries(item: Series) {
    setEditingEpisodeId("");
    setEditingSeriesId(item.id);
    setSeriesEditForm({
      title: item.title,
      originalTitle: item.originalTitle,
      description: item.description,
      coverUrl: item.coverUrl,
      difficulty: item.difficulty,
      genre: item.genre
    });
  }

  function beginEditEpisode(episode: Episode) {
    setEditingSeriesId("");
    setEditingEpisodeId(episode.id);
    setEpisodeEditForm({
      seasonNumber: episode.seasonNumber,
      episodeNumber: episode.episodeNumber,
      title: episode.title,
      description: episode.description,
      mediaUrl: episode.mediaUrl,
      durationMinutes: Math.max(1, Math.round(episode.durationSeconds / 60))
    });
  }

  async function saveEditedSeries(event: React.FormEvent<HTMLFormElement>, item: Series) {
    event.preventDefault();
    setSavingContentId(`series:${item.id}`);
    setMessage("保存剧集中");

    const response = await requestJsonWithError<SeriesResponse>(`/api/admin/series/${item.id}`, {
      method: "PATCH",
      body: {
        ...seriesEditForm,
        originalTitle: seriesEditForm.originalTitle || seriesEditForm.title,
        description: seriesEditForm.description || "个人导入剧集",
        coverUrl: seriesEditForm.coverUrl || defaultCoverUrl,
        difficulty: seriesEditForm.difficulty || "B1",
        genre: seriesEditForm.genre || "生活 / 情景"
      }
    });

    if (response.data) {
      const updated = mapSeriesResponse(response.data);

      setSeries((current) =>
        current.map((entry) =>
          entry.id === item.id
            ? {
                ...entry,
                title: updated.title,
                originalTitle: updated.originalTitle,
                description: updated.description,
                coverUrl: updated.coverUrl,
                difficulty: updated.difficulty,
                genre: updated.genre
              }
            : entry
        )
      );
      setEditingSeriesId("");
      setMessage("剧集已保存");
    } else {
      setMessage(response.error ?? "剧集保存失败");
    }

    setSavingContentId("");
  }

  async function saveEditedEpisode(event: React.FormEvent<HTMLFormElement>, episode: Episode) {
    event.preventDefault();
    setSavingContentId(`episode:${episode.id}`);
    setMessage("保存集数中");

    const response = await requestJsonWithError<EpisodeResponse>(`/api/admin/episodes/${episode.id}`, {
      method: "PATCH",
      body: {
        seasonNumber: episodeEditForm.seasonNumber,
        episodeNumber: episodeEditForm.episodeNumber,
        title: episodeEditForm.title,
        description: episodeEditForm.description || episodeEditForm.title,
        mediaUrl: episodeEditForm.mediaUrl,
        durationSeconds: Math.max(1, episodeEditForm.durationMinutes) * 60
      }
    });

    if (response.data) {
      const updated = mapEpisodeResponse(response.data, {
        seriesId: episode.seriesId,
        seasonNumber: episodeEditForm.seasonNumber,
        episodeNumber: episodeEditForm.episodeNumber,
        durationMinutes: episodeEditForm.durationMinutes
      });

      setSeries((current) =>
        current.map((item) =>
          item.id === updated.seriesId
            ? {
                ...item,
                episodes: sortEpisodesForAdmin(item.episodes.map((entry) => (entry.id === updated.id ? updated : entry)))
              }
            : item
        )
      );
      setEditingEpisodeId("");
      setMessage("集数已保存");
    } else {
      setMessage(response.error === "Episode number already exists" ? "同一剧集下已存在这个季集号" : response.error ?? "集数保存失败");
    }

    setSavingContentId("");
  }

  async function deleteSeries(item: Series) {
    if (!window.confirm(`删除「${item.title}」及其全部集数？`)) {
      return;
    }

    setDeletingContentId(`series:${item.id}`);
    setMessage("删除剧集中");
    const response = await requestJsonWithError<{ id: string }>(`/api/admin/series/${item.id}`, { method: "DELETE" });

    if (response.data) {
      const remainingSeries = series.filter((entry) => entry.id !== item.id);

      setSeries(remainingSeries);
      if (episodeForm.seriesId === item.id) {
        setEpisodeForm((current) => ({
          ...current,
          seriesId: remainingSeries[0]?.id ?? "",
          episodeNumber: nextEpisodeNumber(remainingSeries[0])
        }));
      }
      if (editingSeriesId === item.id) {
        setEditingSeriesId("");
      }
      setMessage("剧集已删除");
    } else {
      setMessage(response.error ?? "剧集删除失败");
    }

    setDeletingContentId("");
  }

  async function deleteEpisode(episode: Episode) {
    if (!window.confirm(`删除 S${episode.seasonNumber}E${episode.episodeNumber}「${episode.title}」？`)) {
      return;
    }

    setDeletingContentId(`episode:${episode.id}`);
    setMessage("删除集数中");
    const response = await requestJsonWithError<{ id: string; seriesId: string }>(`/api/admin/episodes/${episode.id}`, { method: "DELETE" });

    if (response.data) {
      const nextSiblingEpisodeId = series.find((item) => item.id === episode.seriesId)?.episodes.find((entry) => entry.id !== episode.id)?.id ?? "";
      const nextEditorEpisodeId = editorEpisodeId === episode.id ? nextSiblingEpisodeId : editorEpisodeId;

      setSeries((current) =>
        current.map((item) => (item.id === episode.seriesId ? { ...item, episodes: item.episodes.filter((entry) => entry.id !== episode.id) } : item))
      );

      if (subtitleForm.episodeId === episode.id) {
        setSubtitleForm((current) => ({ ...current, episodeId: nextEditorEpisodeId }));
      }
      if (editorEpisodeId === episode.id) {
        setEditorEpisodeId(nextEditorEpisodeId);
        setSubtitleLines([]);
        setSelectedLineId("");
      }
      if (editingEpisodeId === episode.id) {
        setEditingEpisodeId("");
      }
      setMessage("集数已删除");
    } else {
      setMessage(response.error ?? "集数删除失败");
    }

    setDeletingContentId("");
  }

  async function submitSeries(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("创建剧集中");
    const payload = {
      ...seriesForm,
      originalTitle: seriesForm.originalTitle || seriesForm.title,
      description: seriesForm.description || "个人导入剧集",
      coverUrl: seriesForm.coverUrl || defaultCoverUrl,
      difficulty: seriesForm.difficulty || "B1",
      genre: seriesForm.genre || "生活 / 情景"
    };
    const response = await postJson<SeriesResponse>("/api/admin/series", payload);

    if (response) {
      const nextSeries = mapSeriesResponse(response);
      setSeries((current) => [nextSeries, ...current]);
      setEpisodeForm((current) => ({ ...current, seriesId: nextSeries.id, episodeNumber: 1 }));
      setMessage("剧集已创建");
      setSeriesForm((current) => ({ ...current, title: "", originalTitle: "", description: "" }));
    } else {
      setMessage("剧集创建失败");
    }

    setIsSubmitting(false);
  }

  async function submitEpisode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (episodeForm.mediaSource === "local" && !episodeForm.mediaUrl.trim()) {
      setMessage("请先上传媒体文件或填写本地媒体路径");
      return;
    }

    setIsSubmitting(true);
    setMessage("创建集数中");
    const response = await postJson<EpisodeResponse>("/api/admin/episodes", {
      ...episodeForm,
      description: episodeForm.description || episodeForm.title,
      durationSeconds: Math.max(1, episodeForm.durationMinutes) * 60
    });

    if (response) {
      const nextEpisode = mapEpisodeResponse(response, episodeForm);
      setSeries((current) =>
        current.map((item) => (item.id === nextEpisode.seriesId ? { ...item, episodes: [...item.episodes, nextEpisode] } : item))
      );
      setSubtitleForm((current) => ({ ...current, episodeId: nextEpisode.id }));
      setEpisodeForm((current) => ({
        ...current,
        episodeNumber: current.episodeNumber + 1,
        title: "",
        description: "",
        mediaUrl: current.mediaSource === "local" ? "" : current.mediaUrl
      }));
      setMediaUpload({ isUploading: false, error: "", fileName: "" });
      setMessage("集数已创建");
    } else {
      setMessage("集数创建失败");
    }

    setIsSubmitting(false);
  }

  async function uploadEpisodeMedia(file: File | null) {
    if (!file) {
      return;
    }

    setMediaUpload({ isUploading: true, error: "", fileName: file.name });
    setMessage("上传媒体中");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("seasonNumber", String(episodeForm.seasonNumber));
    formData.append("episodeNumber", String(episodeForm.episodeNumber));
    formData.append("title", episodeForm.title);

    const response = await fetch("/api/admin/media", {
      method: "POST",
      body: formData
    }).catch(() => null);
    const payload = response ? ((await response.json().catch(() => null)) as { data?: MediaUploadResponse; error?: string } | null) : null;

    if (response?.ok && payload?.data?.mediaUrl) {
      setEpisodeForm((current) => ({ ...current, mediaSource: "local", mediaUrl: payload.data!.mediaUrl! }));
      setMediaUpload({ isUploading: false, error: "", fileName: file.name });
      setMessage("媒体已上传，本地路径已填入");
      return;
    }

    const error = payload?.error ?? "媒体上传失败";
    setMediaUpload({ isUploading: false, error, fileName: file.name });
    setMessage(error);
  }

  function applyMediaSource(source: MediaSource, forceTemplate = false) {
    setEpisodeForm((current) => {
      const shouldReplace = forceTemplate || !current.mediaUrl.trim() || mediaSources.some((item) => current.mediaUrl === item.hint);

      return {
        ...current,
        mediaSource: source,
        mediaUrl: shouldReplace ? getMediaPathTemplate(source, current) : current.mediaUrl
      };
    });
  }

  function copyMediaPath() {
    if (!episodeForm.mediaUrl.trim()) {
      setMessage("先填写媒体路径");
      return;
    }

    if (!navigator.clipboard) {
      setMessage("当前浏览器不支持自动复制，可手动选中路径");
      return;
    }

    void navigator.clipboard
      .writeText(episodeForm.mediaUrl)
      .then(() => setMessage("媒体路径已复制"))
      .catch(() => setMessage("复制失败，可手动选中路径"));
  }

  async function submitSubtitles(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("导入字幕中");
    const payload = {
      ...subtitleForm,
      sourceFilename: subtitleForm.sourceFilename || "subtitles.srt"
    };
    const response = await postJson<ImportResponse>("/api/admin/import-subtitles", payload);

    if (response) {
      const nextJob = mapImportResponse(response, subtitleForm.sourceFilename);
      setJobs((current) => [nextJob, ...current]);
      setEditorEpisodeId(subtitleForm.episodeId);
      setActivePanel("editor");
      await loadSubtitleLines(subtitleForm.episodeId);
      setMessage(`${nextJob.result}，可继续校对时间轴`);
    } else {
      setMessage("字幕导入失败");
    }

    setIsSubmitting(false);
  }

  async function readSubtitleFile(file: File | null) {
    if (!file) {
      return;
    }

    const text = await file.text().catch(() => "");

    if (text) {
      setSubtitleForm((current) => ({
        ...current,
        sourceFilename: file.name,
        subtitleText: text
      }));
      setMessage("字幕文件已读取");
    } else {
      setMessage("字幕文件读取失败");
    }
  }

  function selectSubtitleLine(line: SubtitleLine) {
    setSelectedLineId(line.id);
    setLineForm({
      englishText: line.englishText,
      chineseText: line.chineseText,
      startMs: line.startMs,
      endMs: line.endMs,
      difficulty: line.difficulty || "B1",
      keywords: line.keywords.join(", ")
    });
  }

  async function loadSubtitleLines(episodeId: string) {
    setMessage("读取字幕中");
    const response = await fetch(`/api/episodes/${episodeId}/subtitles`).catch(() => null);
    const payload = response ? ((await response.json().catch(() => null)) as { data?: SubtitleLine[] } | null) : null;
    const lines = payload?.data ?? [];
    setSubtitleLines(lines);

    if (lines[0]) {
      selectSubtitleLine(lines[0]);
      setMessage(`已读取 ${lines.length} 行字幕`);
    } else {
      setSelectedLineId("");
      setMessage("当前集数还没有字幕");
    }
  }

  useEffect(() => {
    if (activeModule !== "imports" || activePanel !== "editor" || !editorEpisodeId) {
      return;
    }

    let active = true;

    async function loadEditorLines() {
      setMessage("读取字幕中");
      const response = await fetch(`/api/episodes/${editorEpisodeId}/subtitles`).catch(() => null);
      const payload = response ? ((await response.json().catch(() => null)) as { data?: SubtitleLine[] } | null) : null;
      const lines = payload?.data ?? [];

      if (!active) {
        return;
      }

      setSubtitleLines(lines);

      if (lines[0]) {
        selectSubtitleLine(lines[0]);
        setMessage(`已读取 ${lines.length} 行字幕`);
      } else {
        setSelectedLineId("");
        setMessage("当前集数还没有字幕");
      }
    }

    void loadEditorLines();

    return () => {
      active = false;
    };
  }, [activeModule, activePanel, editorEpisodeId]);

  async function saveSubtitleLine(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedLineId) {
      return;
    }

    setIsSubmitting(true);
    setMessage("保存字幕中");
    const response = await fetch(`/api/admin/subtitle-lines/${selectedLineId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        englishText: lineForm.englishText,
        chineseText: lineForm.chineseText,
        startMs: lineForm.startMs,
        endMs: lineForm.endMs,
        difficulty: lineForm.difficulty,
        keywords: splitKeywords(lineForm.keywords)
      })
    }).catch(() => null);
    const payload = response ? ((await response.json().catch(() => null)) as { data?: SubtitleLineResponse; error?: string } | null) : null;

    if (response?.ok && payload?.data) {
      const updatedLine = mapSubtitleLineResponse(payload.data);
      setSubtitleLines((current) =>
        current.map((line) => (line.id === selectedLineId ? updatedLine : line))
      );
      selectSubtitleLine(updatedLine);
      setMessage("字幕已保存");
    } else {
      setMessage(payload?.error ?? "字幕保存失败");
    }

    setIsSubmitting(false);
  }

  async function updateUserRole(userId: string, role: AdminUser["role"]) {
    setSavingUserId(userId);
    setMessage("更新用户权限中");
    const response = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role })
    }).catch(() => null);

    if (response?.ok) {
      setUsers((current) => current.map((user) => (user.id === userId ? { ...user, role } : user)));
      setMessage("用户权限已更新");
    } else {
      const payload = response ? ((await response.json().catch(() => null)) as { error?: string } | null) : null;
      setMessage(payload?.error === "At least one admin is required" ? "至少要保留一个管理员" : "用户权限更新失败");
    }

    setSavingUserId("");
  }

  async function saveSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("保存网站设置中");
    const response = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...settings,
        dictionaryApiKey: dictionaryApiKeyInput
      })
    }).catch(() => null);
    const payload = response ? ((await response.json().catch(() => null)) as { data?: SiteSettings; error?: string } | null) : null;

    if (response?.ok && payload?.data) {
      setSettings(payload.data);
      setDictionaryApiKeyInput("");
      setMessage("网站设置已保存");
    } else {
      setMessage(payload?.error ?? "网站设置保存失败");
    }

    setIsSubmitting(false);
  }

  return (
    <section className="grid gap-4">
      <div className="grid gap-3 md:grid-cols-4">
        <MetricTile label="剧集" value={String(series.length)} icon={Database} tone="green" />
        <MetricTile label="片段" value={String(totalEpisodes)} icon={Film} tone="amber" />
        <MetricTile label="用户" value={String(users.length)} icon={Users} tone="ink" />
        <MetricTile label="管理员" value={String(adminCount)} icon={ShieldCheck} tone="red" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[248px_1fr]">
        <aside className="rounded-md border border-[color:var(--line)] bg-[color:var(--panel)] p-3">
          <div className="mb-3 flex items-center gap-2 px-1">
            <ShieldCheck className="h-5 w-5 text-[color:var(--green)]" aria-hidden="true" />
            <h2 className="font-bold">后台管理</h2>
          </div>
          <div className="grid gap-2">
            <ModuleButton active={activeModule === "imports"} onClick={() => setActiveModule("imports")} icon={FileUp} label="导入管理" meta={`${series.length} 个剧集`} />
            <ModuleButton active={activeModule === "users"} onClick={() => setActiveModule("users")} icon={UserCog} label="用户管理" meta={`${users.length} 个账户`} />
            <ModuleButton active={activeModule === "permissions"} onClick={() => setActiveModule("permissions")} icon={KeyRound} label="权限管理" meta={`${adminCount} 个管理员`} />
            <ModuleButton active={activeModule === "settings"} onClick={() => setActiveModule("settings")} icon={Settings2} label="网站设置" meta={settings.dictionaryProvider} />
          </div>
          {message ? <p className="mt-3 rounded-md border border-[color:var(--line)] bg-white/60 p-3 text-sm leading-6 text-[color:var(--muted)]">{message}</p> : null}
        </aside>

        {activeModule === "imports" ? renderImportModule() : null}
        {activeModule === "users" ? renderUsersModule() : null}
        {activeModule === "permissions" ? renderPermissionsModule() : null}
        {activeModule === "settings" ? renderSettingsModule() : null}
      </div>
    </section>
  );

  function renderImportModule() {
    return (
      <section className="grid gap-4 xl:grid-cols-[360px_1fr]">
        <aside className="space-y-4">
          <div className="rounded-md border border-[color:var(--line)] bg-[color:var(--panel)] p-4">
            <div className="mb-4 flex items-center gap-2">
              <FileUp className="h-5 w-5 text-[color:var(--green)]" aria-hidden="true" />
              <h2 className="text-xl font-bold">导入入口</h2>
            </div>
            <div className="grid grid-cols-5 gap-2">
              <PanelButton active={activePanel === "auto"} onClick={() => setActivePanel("auto")} icon={FolderInput} label="自动" />
              <PanelButton active={activePanel === "series"} onClick={() => setActivePanel("series")} icon={Plus} label="剧集" />
              <PanelButton active={activePanel === "episode"} onClick={() => setActivePanel("episode")} icon={Film} label="集数" />
              <PanelButton active={activePanel === "subtitles"} onClick={() => setActivePanel("subtitles")} icon={FileUp} label="字幕" />
              <PanelButton active={activePanel === "editor"} onClick={() => setActivePanel("editor")} icon={ListChecks} label="编辑" />
            </div>
          </div>

          {activePanel === "auto" ? (
            <form onSubmit={scanAutoImportDirectory} className="rounded-md border border-[color:var(--line)] bg-[color:var(--panel)] p-4">
              <h3 className="font-bold">自动识别目录</h3>
              <div className="mt-4 grid gap-3">
                <TextField label="媒体目录" value={autoImportDirectory} required onChange={setAutoImportDirectory} />
                <p className="rounded-md border border-[color:var(--line)] bg-white/45 px-3 py-2 text-xs leading-5 text-[color:var(--muted)]">
                  填写 LOCAL_MEDIA_ROOT 下的相对目录；视频与同名 .srt / .vtt 放在同一目录。
                </p>
              </div>
              <SubmitButton disabled={autoImportMode !== "idle"} label="扫描目录" />
            </form>
          ) : null}

          {activePanel === "series" ? (
            <form onSubmit={submitSeries} className="rounded-md border border-[color:var(--line)] bg-[color:var(--panel)] p-4">
              <h3 className="font-bold">新建剧集</h3>
              <div className="mt-4 grid gap-3">
                <TextField label="剧名" value={seriesForm.title} required onChange={(value) => setSeriesForm((current) => ({ ...current, title: value }))} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <ComboField label="难度" value={seriesForm.difficulty} options={difficultyOptions} required onChange={(value) => setSeriesForm((current) => ({ ...current, difficulty: value }))} />
                  <ComboField label="题材" value={seriesForm.genre} options={genreOptions} required onChange={(value) => setSeriesForm((current) => ({ ...current, genre: value }))} />
                </div>
                <AdvancedFields>
                  <TextField label="英文名" value={seriesForm.originalTitle} onChange={(value) => setSeriesForm((current) => ({ ...current, originalTitle: value }))} />
                  <TextArea label="简介" value={seriesForm.description} onChange={(value) => setSeriesForm((current) => ({ ...current, description: value }))} />
                  <TextField label="封面 URL" value={seriesForm.coverUrl} onChange={(value) => setSeriesForm((current) => ({ ...current, coverUrl: value }))} />
                </AdvancedFields>
              </div>
              <SubmitButton disabled={isSubmitting} label="创建剧集" />
            </form>
          ) : null}

          {activePanel === "episode" ? (
            <form onSubmit={submitEpisode} className="rounded-md border border-[color:var(--line)] bg-[color:var(--panel)] p-4">
              <h3 className="font-bold">新建集数</h3>
              <div className="mt-4 grid gap-3">
                <SelectField label="所属剧集" value={episodeForm.seriesId} onChange={updateEpisodeSeries}>
                  {series.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                    </option>
                  ))}
                </SelectField>
                <TextField label="标题" value={episodeForm.title} required onChange={(value) => setEpisodeForm((current) => ({ ...current, title: value }))} />
                <section className="rounded-md border border-[color:var(--line)] bg-white/45 p-3">
                  <div className="mb-3 flex items-center gap-2">
                    <Server className="h-4 w-4 text-[color:var(--green)]" aria-hidden="true" />
                    <h4 className="text-sm font-bold">媒体来源</h4>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {mediaSources.map((source) => (
                      <button
                        key={source.id}
                        type="button"
                        onClick={() => applyMediaSource(source.id)}
                        className={cn(
                          "flex min-h-12 items-center justify-between gap-3 rounded-md border border-[color:var(--line)] px-3 py-2 text-left text-sm transition hover:border-[color:var(--ink)]",
                          episodeForm.mediaSource === source.id && "border-[color:var(--ink)] bg-white"
                        )}
                      >
                        <span>
                          <span className="block font-bold">{source.label}</span>
                          <span className="mt-0.5 block truncate text-xs text-[color:var(--muted)]">{source.hint}</span>
                        </span>
                        {source.id === "local" ? <FolderInput className="h-4 w-4 shrink-0 text-[color:var(--amber)]" aria-hidden="true" /> : null}
                      </button>
                    ))}
                  </div>
                  {episodeForm.mediaSource === "local" ? (
                    <label className="mt-3 grid gap-2 text-sm font-semibold">
                      上传媒体文件
                      <input
                        type="file"
                        accept="video/mp4,video/webm,video/quicktime,video/x-m4v,.mp4,.webm,.mov,.m4v"
                        disabled={mediaUpload.isUploading}
                        onChange={(event) => void uploadEpisodeMedia(event.target.files?.[0] ?? null)}
                        className="rounded-md border border-[color:var(--line)] bg-white/70 px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-[color:var(--ink)] file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white disabled:cursor-wait disabled:opacity-60"
                      />
                      {mediaUpload.fileName ? (
                        <span className="text-xs text-[color:var(--muted)]">
                          {mediaUpload.isUploading ? "上传中：" : "已选择："}
                          {mediaUpload.fileName}
                        </span>
                      ) : null}
                      {mediaUpload.error ? <span className="text-xs text-[color:var(--red)]">{mediaUpload.error}</span> : null}
                    </label>
                  ) : null}
                  <div className="mt-3 grid gap-2">
                    <TextField label="媒体路径" value={episodeForm.mediaUrl} onChange={(value) => setEpisodeForm((current) => ({ ...current, mediaUrl: value }))} />
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => applyMediaSource(episodeForm.mediaSource, true)} className="h-9 rounded-md border border-[color:var(--line)] px-3 text-xs font-semibold hover:border-[color:var(--ink)]">
                        套用模板
                      </button>
                      <button type="button" onClick={copyMediaPath} className="flex h-9 items-center gap-2 rounded-md border border-[color:var(--line)] px-3 text-xs font-semibold hover:border-[color:var(--ink)]">
                        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                        复制路径
                      </button>
                    </div>
                  </div>
                  <p className="mt-3 rounded-md border border-[color:var(--line)] bg-[color:var(--paper)] px-3 py-2 text-xs leading-5 text-[color:var(--muted)]">
                    本地媒体使用 local/ 前缀，对应服务器 LOCAL_MEDIA_ROOT 目录；Docker 部署时把视频目录挂载到该路径。
                  </p>
                </section>
                <AdvancedFields>
                  <div className="grid grid-cols-3 gap-3">
                    <NumberField label="季" value={episodeForm.seasonNumber} min={1} onChange={(value) => setEpisodeForm((current) => ({ ...current, seasonNumber: value }))} />
                    <NumberField label="集" value={episodeForm.episodeNumber} min={1} onChange={(value) => setEpisodeForm((current) => ({ ...current, episodeNumber: value }))} />
                    <NumberField label="分钟" value={episodeForm.durationMinutes} min={1} onChange={(value) => setEpisodeForm((current) => ({ ...current, durationMinutes: value }))} />
                  </div>
                  <TextArea label="简介" value={episodeForm.description} onChange={(value) => setEpisodeForm((current) => ({ ...current, description: value }))} />
                </AdvancedFields>
              </div>
              <SubmitButton disabled={isSubmitting || mediaUpload.isUploading || !episodeForm.seriesId || (episodeForm.mediaSource === "local" && !episodeForm.mediaUrl.trim())} label="创建集数" />
            </form>
          ) : null}

          {activePanel === "subtitles" ? (
            <form onSubmit={submitSubtitles} className="rounded-md border border-[color:var(--line)] bg-[color:var(--panel)] p-4">
              <h3 className="font-bold">导入字幕</h3>
              <div className="mt-4 grid gap-3">
                <SelectField label="目标集数" value={subtitleForm.episodeId} onChange={(value) => setSubtitleForm((current) => ({ ...current, episodeId: value }))}>
                  {episodes.map((episode) => (
                    <option key={episode.id} value={episode.id}>
                      {episode.seriesTitle} S{episode.seasonNumber}E{episode.episodeNumber} · {episode.title}
                    </option>
                  ))}
                </SelectField>
                <label className="grid gap-2 text-sm font-semibold">
                  选择文件
                  <input
                    type="file"
                    accept=".srt,.vtt,text/vtt,text/plain"
                    onChange={(event) => void readSubtitleFile(event.target.files?.[0] ?? null)}
                    className="rounded-md border border-[color:var(--line)] bg-white/70 px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-[color:var(--ink)] file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white"
                  />
                </label>
                <TextArea label="SRT / VTT" value={subtitleForm.subtitleText} rows={10} required onChange={(value) => setSubtitleForm((current) => ({ ...current, subtitleText: value }))} />
                <AdvancedFields>
                  <TextField label="文件名" value={subtitleForm.sourceFilename} required onChange={(value) => setSubtitleForm((current) => ({ ...current, sourceFilename: value }))} />
                </AdvancedFields>
              </div>
              <SubmitButton disabled={isSubmitting || !subtitleForm.episodeId} label="导入字幕" />
            </form>
          ) : null}

          {activePanel === "editor" ? (
            <form onSubmit={saveSubtitleLine} className="rounded-md border border-[color:var(--line)] bg-[color:var(--panel)] p-4">
              <h3 className="font-bold">编辑字幕</h3>
              <div className="mt-4 grid gap-3">
                <SelectField label="目标集数" value={editorEpisodeId} onChange={setEditorEpisodeId}>
                  {episodes.map((episode) => (
                    <option key={episode.id} value={episode.id}>
                      {episode.seriesTitle} S{episode.seasonNumber}E{episode.episodeNumber} · {episode.title}
                    </option>
                  ))}
                </SelectField>

                <div className="quiet-scrollbar max-h-56 space-y-2 overflow-y-auto rounded-md border border-[color:var(--line)] bg-white/50 p-2">
                  {subtitleLines.map((line) => (
                    <button
                      key={line.id}
                      type="button"
                      onClick={() => selectSubtitleLine(line)}
                      className={cn("w-full rounded border border-[color:var(--line)] p-2 text-left text-sm", selectedLineId === line.id && "border-[color:var(--ink)] bg-white")}
                    >
                      <span className="mb-1 block text-xs text-[color:var(--muted)]">
                        第 {line.lineIndex} 句 · {line.startMs}ms
                      </span>
                      <span className="line-clamp-1 font-semibold">{line.englishText}</span>
                    </button>
                  ))}
                </div>

                <TextArea label="英文" value={lineForm.englishText} rows={3} required onChange={(value) => setLineForm((current) => ({ ...current, englishText: value }))} />
                <TextArea label="中文" value={lineForm.chineseText} rows={2} onChange={(value) => setLineForm((current) => ({ ...current, chineseText: value }))} />
                <div className="grid grid-cols-2 gap-3">
                  <NumberField label="开始 ms" value={lineForm.startMs} min={0} onChange={(value) => setLineForm((current) => ({ ...current, startMs: value }))} />
                  <NumberField label="结束 ms" value={lineForm.endMs} min={1} onChange={(value) => setLineForm((current) => ({ ...current, endMs: value }))} />
                </div>
                <div className="grid grid-cols-[96px_1fr] gap-3">
                  <TextField label="难度" value={lineForm.difficulty} required onChange={(value) => setLineForm((current) => ({ ...current, difficulty: value }))} />
                  <TextField label="关键词" value={lineForm.keywords} onChange={(value) => setLineForm((current) => ({ ...current, keywords: value }))} />
                </div>
              </div>
              <SubmitButton disabled={isSubmitting || !selectedLineId} label="保存字幕" />
            </form>
          ) : null}
        </aside>

        <div className="grid content-start gap-4">
          {activePanel === "auto" && autoImportDraft ? (
            <AutoImportPreview draft={autoImportDraft} isImporting={autoImportMode === "importing"} onConfirm={() => void confirmAutoImport()} onSeriesChange={updateAutoImportSeries} />
          ) : null}

          <section className="rounded-md border border-[color:var(--line)] bg-[color:var(--panel)] p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">已导入内容</h2>
                <p className="mt-1 text-sm text-[color:var(--muted)]">{totalEpisodes} 个片段可用于学习</p>
              </div>
              {latestJob ? <StatusBadge label={statusText[latestJob.status]} /> : null}
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {series.length === 0 ? (
                <div className="rounded-md border border-[color:var(--line)] p-4 md:col-span-2">
                  <h3 className="font-bold">还没有导入内容</h3>
                  <p className="mt-2 text-sm text-[color:var(--muted)]">先创建剧集，再添加集数和字幕。</p>
                </div>
              ) : null}
              {series.map((item) => {
                const isEditingSeries = editingSeriesId === item.id;
                const isSavingSeries = savingContentId === `series:${item.id}`;
                const isDeletingSeries = deletingContentId === `series:${item.id}`;

                return (
                  <article key={item.id} className="rounded-md border border-[color:var(--line)] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate font-bold">{item.title}</h3>
                        <p className="mt-1 text-sm text-[color:var(--muted)]">
                          {item.episodes.length} 集 · {item.difficulty}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <StatusBadge label={item.genre || "未分类"} />
                        <ContentIconButton icon={Pencil} label="编辑剧集" onClick={() => beginEditSeries(item)} active={isEditingSeries} disabled={isSavingSeries || isDeletingSeries} />
                        <ContentIconButton icon={Trash2} label="删除剧集" onClick={() => void deleteSeries(item)} tone="danger" disabled={isSavingSeries || isDeletingSeries} />
                      </div>
                    </div>

                    {isEditingSeries ? (
                      <form onSubmit={(event) => void saveEditedSeries(event, item)} className="mt-4 grid gap-3 border-t border-[color:var(--line)] pt-4">
                        <TextField label="剧名" value={seriesEditForm.title} required onChange={(value) => setSeriesEditForm((current) => ({ ...current, title: value }))} />
                        <div className="grid gap-3 sm:grid-cols-2">
                          <ComboField label="难度" value={seriesEditForm.difficulty} options={difficultyOptions} required onChange={(value) => setSeriesEditForm((current) => ({ ...current, difficulty: value }))} />
                          <ComboField label="题材" value={seriesEditForm.genre} options={genreOptions} required onChange={(value) => setSeriesEditForm((current) => ({ ...current, genre: value }))} />
                        </div>
                        <TextField label="英文名" value={seriesEditForm.originalTitle} onChange={(value) => setSeriesEditForm((current) => ({ ...current, originalTitle: value }))} />
                        <TextField label="封面 URL" value={seriesEditForm.coverUrl} onChange={(value) => setSeriesEditForm((current) => ({ ...current, coverUrl: value }))} />
                        <TextArea label="简介" value={seriesEditForm.description} rows={2} onChange={(value) => setSeriesEditForm((current) => ({ ...current, description: value }))} />
                        <div className="grid grid-cols-2 gap-2">
                          <button type="submit" disabled={isSavingSeries} className="ink-action flex h-10 items-center justify-center gap-2 rounded-md text-sm font-semibold disabled:cursor-wait disabled:opacity-60">
                            <Save className="h-4 w-4" aria-hidden="true" />
                            {isSavingSeries ? "保存中" : "保存"}
                          </button>
                          <button type="button" onClick={() => setEditingSeriesId("")} className="flex h-10 items-center justify-center gap-2 rounded-md border border-[color:var(--line)] text-sm font-semibold hover:border-[color:var(--ink)]">
                            <X className="h-4 w-4" aria-hidden="true" />
                            取消
                          </button>
                        </div>
                      </form>
                    ) : null}

                    <div className="mt-3 h-2 rounded-full bg-black/10">
                      <div className="h-2 rounded-full bg-[color:var(--amber)]" style={{ width: `${item.progress}%` }} />
                    </div>
                    <div className="quiet-scrollbar mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
                      {item.episodes.length === 0 ? (
                        <div className="rounded border border-dashed border-[color:var(--line)] px-3 py-2 text-sm text-[color:var(--muted)]">暂无集数</div>
                      ) : null}
                      {item.episodes.map((episode) => {
                        const isEditingEpisode = editingEpisodeId === episode.id;
                        const isSavingEpisode = savingContentId === `episode:${episode.id}`;
                        const isDeletingEpisode = deletingContentId === `episode:${episode.id}`;

                        return (
                          <article key={episode.id} className="rounded border border-[color:var(--line)] px-3 py-2 text-sm">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate font-semibold">
                                  S{episode.seasonNumber}E{episode.episodeNumber} · {episode.title}
                                </p>
                                <p className="mt-1 truncate text-xs text-[color:var(--muted)]">{episode.mediaUrl || "未设置媒体"}</p>
                              </div>
                              <div className="flex shrink-0 items-center gap-1">
                                <ContentIconButton icon={Pencil} label="编辑集数" onClick={() => beginEditEpisode(episode)} active={isEditingEpisode} disabled={isSavingEpisode || isDeletingEpisode} />
                                <ContentIconButton icon={Trash2} label="删除集数" onClick={() => void deleteEpisode(episode)} tone="danger" disabled={isSavingEpisode || isDeletingEpisode} />
                              </div>
                            </div>

                            {isEditingEpisode ? (
                              <form onSubmit={(event) => void saveEditedEpisode(event, episode)} className="mt-3 grid gap-3 border-t border-[color:var(--line)] pt-3">
                                <div className="grid grid-cols-3 gap-2">
                                  <NumberField label="季" value={episodeEditForm.seasonNumber} min={1} onChange={(value) => setEpisodeEditForm((current) => ({ ...current, seasonNumber: value }))} />
                                  <NumberField label="集" value={episodeEditForm.episodeNumber} min={1} onChange={(value) => setEpisodeEditForm((current) => ({ ...current, episodeNumber: value }))} />
                                  <NumberField label="分钟" value={episodeEditForm.durationMinutes} min={1} onChange={(value) => setEpisodeEditForm((current) => ({ ...current, durationMinutes: value }))} />
                                </div>
                                <TextField label="标题" value={episodeEditForm.title} required onChange={(value) => setEpisodeEditForm((current) => ({ ...current, title: value }))} />
                                <TextField label="媒体路径" value={episodeEditForm.mediaUrl} onChange={(value) => setEpisodeEditForm((current) => ({ ...current, mediaUrl: value }))} />
                                <TextArea label="简介" value={episodeEditForm.description} rows={2} onChange={(value) => setEpisodeEditForm((current) => ({ ...current, description: value }))} />
                                <div className="grid grid-cols-2 gap-2">
                                  <button type="submit" disabled={isSavingEpisode} className="ink-action flex h-10 items-center justify-center gap-2 rounded-md text-sm font-semibold disabled:cursor-wait disabled:opacity-60">
                                    <Save className="h-4 w-4" aria-hidden="true" />
                                    {isSavingEpisode ? "保存中" : "保存"}
                                  </button>
                                  <button type="button" onClick={() => setEditingEpisodeId("")} className="flex h-10 items-center justify-center gap-2 rounded-md border border-[color:var(--line)] text-sm font-semibold hover:border-[color:var(--ink)]">
                                    <X className="h-4 w-4" aria-hidden="true" />
                                    取消
                                  </button>
                                </div>
                              </form>
                            ) : null}
                          </article>
                        );
                      })}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="rounded-md border border-[color:var(--line)] bg-[color:var(--panel)] p-5">
            <h2 className="text-xl font-bold">导入任务</h2>
            <div className="mt-4 space-y-3">
              {jobs.length === 0 ? (
                <div className="rounded-md border border-[color:var(--line)] p-4">
                  <h3 className="font-bold">暂无导入任务</h3>
                  <p className="mt-2 text-sm text-[color:var(--muted)]">字幕导入后会在这里显示解析结果。</p>
                </div>
              ) : null}
              {jobs.map((job) => (
                <article key={job.id} className="rounded-md border border-[color:var(--line)] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="font-bold">{job.title}</h3>
                    <StatusBadge label={statusText[job.status]} />
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">{job.result}</p>
                  <p className="mt-2 text-xs text-[color:var(--muted)]">{job.createdAt}</p>
                </article>
              ))}
            </div>
          </section>
        </div>
      </section>
    );
  }

  function renderUsersModule() {
    return (
      <section className="rounded-md border border-[color:var(--line)] bg-[color:var(--panel)] p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">用户管理</h2>
            <p className="mt-1 text-sm text-[color:var(--muted)]">查看账户、登录状态和角色</p>
          </div>
          <StatusBadge label={`${users.length} 个用户`} />
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] border-separate border-spacing-0 text-left text-sm">
            <thead>
              <tr className="text-xs uppercase text-[color:var(--muted)]">
                <th className="border-b border-[color:var(--line)] px-3 py-3">用户</th>
                <th className="border-b border-[color:var(--line)] px-3 py-3">角色</th>
                <th className="border-b border-[color:var(--line)] px-3 py-3">创建时间</th>
                <th className="border-b border-[color:var(--line)] px-3 py-3">最近登录</th>
                <th className="border-b border-[color:var(--line)] px-3 py-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="border-b border-[color:var(--line)] px-3 py-3">
                    <div className="font-semibold">{user.displayName}</div>
                    <div className="mt-1 text-xs text-[color:var(--muted)]">{user.email}</div>
                  </td>
                  <td className="border-b border-[color:var(--line)] px-3 py-3">
                    <StatusBadge label={user.role === "admin" ? "管理员" : "用户"} />
                  </td>
                  <td className="border-b border-[color:var(--line)] px-3 py-3 text-[color:var(--muted)]">{user.createdAt}</td>
                  <td className="border-b border-[color:var(--line)] px-3 py-3 text-[color:var(--muted)]">{user.lastSignInAt}</td>
                  <td className="border-b border-[color:var(--line)] px-3 py-3">
                    <div className="flex justify-end">
                      <select
                        value={user.role}
                        disabled={savingUserId === user.id}
                        onChange={(event) => void updateUserRole(user.id, event.target.value as AdminUser["role"])}
                        className="h-10 rounded-md border border-[color:var(--line)] bg-white/70 px-3 text-sm font-semibold outline-none focus:border-[color:var(--ink)]"
                      >
                        <option value="user">用户</option>
                        <option value="admin">管理员</option>
                      </select>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  function renderPermissionsModule() {
    const rules = [
      { icon: Lock, title: "未登录用户", body: "不能进入学习页、进度页、计划页、生词页和后台页。" },
      { icon: BookOpenCheck, title: "普通用户", body: "可以学习已发布内容，管理自己的计划、进度和生词。" },
      { icon: ShieldCheck, title: "管理员", body: "可以进入后台，导入内容、编辑字幕、管理用户角色和网站设置。" }
    ];

    return (
      <section className="grid gap-4">
        <div className="rounded-md border border-[color:var(--line)] bg-[color:var(--panel)] p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">权限管理</h2>
              <p className="mt-1 text-sm text-[color:var(--muted)]">当前按 profile.role 控制访问</p>
            </div>
            <StatusBadge label={`${adminCount} 个管理员`} />
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {rules.map((rule) => (
              <article key={rule.title} className="rounded-md border border-[color:var(--line)] p-4">
                <rule.icon className="h-5 w-5 text-[color:var(--amber)]" aria-hidden="true" />
                <h3 className="mt-3 font-bold">{rule.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">{rule.body}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="rounded-md border border-[color:var(--line)] bg-[color:var(--panel)] p-5">
          <h3 className="font-bold">管理员名单</h3>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {users
              .filter((user) => user.role === "admin")
              .map((user) => (
                <div key={user.id} className="flex items-center justify-between gap-3 rounded-md border border-[color:var(--line)] px-3 py-2 text-sm">
                  <span className="min-w-0 truncate font-semibold">{user.email}</span>
                  <StatusBadge label="admin" />
                </div>
              ))}
          </div>
        </div>
      </section>
    );
  }

  function renderSettingsModule() {
    return (
      <form onSubmit={saveSettings} className="rounded-md border border-[color:var(--line)] bg-[color:var(--panel)] p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">整体网站设置</h2>
            <p className="mt-1 text-sm text-[color:var(--muted)]">学习默认值、AI 开关和字典配置</p>
          </div>
          <button disabled={isSubmitting} className="ink-action flex h-10 items-center gap-2 rounded-md px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60">
            <Save className="h-4 w-4" aria-hidden="true" />
            {isSubmitting ? "保存中" : "保存设置"}
          </button>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          <section className="rounded-md border border-[color:var(--line)] p-4">
            <div className="mb-4 flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-[color:var(--green)]" aria-hidden="true" />
              <h3 className="font-bold">站点信息</h3>
            </div>
            <div className="grid gap-3">
              <TextField label="应用名称" value={settings.appName} required onChange={(value) => setSettings((current) => ({ ...current, appName: value }))} />
              <TextField label="工作台副标题" value={settings.workspaceSubtitle} required onChange={(value) => setSettings((current) => ({ ...current, workspaceSubtitle: value }))} />
              <ToggleField label="允许公开注册" checked={settings.allowPublicSignup} onChange={(value) => setSettings((current) => ({ ...current, allowPublicSignup: value }))} />
            </div>
          </section>

          <section className="rounded-md border border-[color:var(--line)] p-4">
            <div className="mb-4 flex items-center gap-2">
              <SlidersHorizontal className="h-5 w-5 text-[color:var(--amber)]" aria-hidden="true" />
              <h3 className="font-bold">默认学习计划</h3>
            </div>
            <div className="grid gap-3 min-[1360px]:grid-cols-3">
              <NumberField label="分钟" value={settings.defaultDailyMinutes} min={1} onChange={(value) => setSettings((current) => ({ ...current, defaultDailyMinutes: value }))} />
              <NumberField label="句子" value={settings.defaultDailyLines} min={1} onChange={(value) => setSettings((current) => ({ ...current, defaultDailyLines: value }))} />
              <NumberField label="跟读" value={settings.defaultDailyRepeats} min={1} onChange={(value) => setSettings((current) => ({ ...current, defaultDailyRepeats: value }))} />
            </div>
          </section>

          <section className="rounded-md border border-[color:var(--line)] p-4 xl:col-span-2">
            <div className="mb-4 flex items-center gap-2">
              <Database className="h-5 w-5 text-[color:var(--red)]" aria-hidden="true" />
              <h3 className="font-bold">AI 与查词</h3>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <ToggleField label="启用跟读评分" checked={settings.aiScoringEnabled} onChange={(value) => setSettings((current) => ({ ...current, aiScoringEnabled: value }))} />
              <ToggleField label="启用 AI 中文释义" checked={settings.dictionaryAiEnabled} onChange={(value) => setSettings((current) => ({ ...current, dictionaryAiEnabled: value }))} />
              <ComboField label="字典 Provider" value={settings.dictionaryProvider} options={dictionaryProviderOptions} required onChange={(value) => setSettings((current) => ({ ...current, dictionaryProvider: value }))} />
              <TextField label="字典模型" value={settings.dictionaryModel} required onChange={(value) => setSettings((current) => ({ ...current, dictionaryModel: value }))} />
              <SecretField
                label="查词 API Key"
                value={dictionaryApiKeyInput}
                configured={settings.dictionaryApiKeyConfigured}
                onChange={setDictionaryApiKeyInput}
              />
            </div>
          </section>
        </div>
      </form>
    );
  }
}

function AutoImportPreview({
  draft,
  isImporting,
  onConfirm,
  onSeriesChange
}: {
  draft: AutoImportDraft;
  isImporting: boolean;
  onConfirm: () => void;
  onSeriesChange: <K extends keyof AutoImportSeriesDraft>(key: K, value: AutoImportSeriesDraft[K]) => void;
}) {
  const matchedSubtitleCount = draft.episodes.filter((episode) => episode.subtitlePath).length;
  const hasDuplicateEpisode = draft.warnings.some((warning) => warning.includes("重复集号"));
  const canImport = draft.episodes.length > 0 && !hasDuplicateEpisode && !isImporting;
  const sourceLabel = (label: string, key: keyof AutoImportSeriesDraft) => `${label}（${formatFieldSource(draft.seriesFieldSources?.[key])}）`;

  return (
    <section className="rounded-md border border-[color:var(--ink)] bg-[color:var(--paper)] p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">自动识别草稿</h2>
          <p className="mt-1 text-sm text-[color:var(--muted)]">
            {draft.directory} · {draft.episodes.length} 集 · {matchedSubtitleCount} 个字幕
          </p>
        </div>
        <button
          type="button"
          onClick={onConfirm}
          disabled={!canImport}
          className="ink-action flex h-10 items-center gap-2 rounded-md px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Save className="h-4 w-4" aria-hidden="true" />
          {isImporting ? "导入中" : "确认导入"}
        </button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <TextField label={sourceLabel("剧名", "title")} value={draft.series.title} required onChange={(value) => onSeriesChange("title", value)} />
        <ComboField label={sourceLabel("难度", "difficulty")} value={draft.series.difficulty} options={difficultyOptions} required onChange={(value) => onSeriesChange("difficulty", value)} />
        <ComboField label={sourceLabel("题材", "genre")} value={draft.series.genre} options={genreOptions} required onChange={(value) => onSeriesChange("genre", value)} />
        <div className="md:col-span-3">
          <TextArea label={sourceLabel("简介", "description")} value={draft.series.description} rows={2} required onChange={(value) => onSeriesChange("description", value)} />
        </div>
      </div>

      {draft.warnings.length > 0 ? (
        <div className="mt-4 grid gap-2">
          {draft.warnings.map((warning) => (
            <p key={warning} className={cn("rounded-md border px-3 py-2 text-sm", warning.includes("重复集号") ? "border-[color:var(--red)]/35 bg-[rgba(190,68,51,0.08)] text-[color:var(--red)]" : "border-[color:var(--amber)]/35 bg-[rgba(184,126,42,0.1)] text-[color:var(--amber)]")}>
              {warning}
            </p>
          ))}
        </div>
      ) : null}

      <div className="mt-4 grid gap-2">
        {draft.episodes.map((episode) => (
          <article key={episode.draftId} className="rounded-md border border-[color:var(--line)] bg-white/60 p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate font-bold">
                  S{episode.seasonNumber}E{episode.episodeNumber} · {episode.title}
                </h3>
                <p className="mt-1 truncate text-xs text-[color:var(--muted)]">{episode.mediaFilename}</p>
              </div>
              <StatusBadge label={episode.subtitlePath ? `${episode.subtitleLineCount} 行字幕` : "缺字幕"} />
            </div>
            <div className="mt-3 grid gap-2 text-xs text-[color:var(--muted)] sm:grid-cols-[1fr_120px]">
              <span className="truncate">{episode.subtitleFilename ?? "未匹配同名字幕"}</span>
              <span className="sm:text-right">{formatDurationMinutes(episode.durationSeconds)}</span>
            </div>
            {episode.issues.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {episode.issues.map((issue) => (
                  <span key={issue} className="rounded border border-[color:var(--amber)]/35 px-2 py-1 text-xs font-semibold text-[color:var(--amber)]">
                    {issue}
                  </span>
                ))}
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function formatFieldSource(source?: AutoImportSeriesFieldSource) {
  if (source === "metadata") {
    return "元数据";
  }

  if (source === "filename") {
    return "文件名";
  }

  return "默认";
}

function formatDurationMinutes(seconds: number) {
  return `${Math.max(1, Math.round(seconds / 60))} 分钟`;
}

async function postJson<T>(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  }).catch(() => null);

  if (!response?.ok) {
    return null;
  }

  const payload = (await response.json().catch(() => null)) as { data?: T } | null;
  return payload?.data ?? null;
}

async function postJsonWithError<T>(url: string, body: unknown): Promise<{ data?: T; error?: string }> {
  return requestJsonWithError(url, { method: "POST", body });
}

async function requestJsonWithError<T>(
  url: string,
  options: {
    method: "POST" | "PATCH" | "DELETE";
    body?: unknown;
  }
): Promise<{ data?: T; error?: string }> {
  const response = await fetch(url, {
    method: options.method,
    headers: { "Content-Type": "application/json" },
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  }).catch(() => null);
  const payload = response ? ((await response.json().catch(() => null)) as { data?: T; error?: string } | null) : null;

  if (!response?.ok) {
    return { error: payload?.error ?? "请求失败" };
  }

  return { data: payload?.data };
}

function mapSeriesResponse(row: SeriesResponse): Series {
  return {
    id: row.id,
    title: row.title,
    originalTitle: row.originalTitle ?? row.original_title ?? "",
    description: row.description ?? "",
    coverUrl: row.coverUrl ?? row.cover_url ?? "",
    difficulty: row.difficulty ?? "B1",
    genre: row.genre ?? "",
    progress: 0,
    episodes: []
  };
}

function mapEpisodeResponse(row: EpisodeResponse, fallback: { seriesId: string; seasonNumber: number; episodeNumber: number; durationMinutes: number }): Episode {
  return {
    id: row.id,
    seriesId: row.seriesId ?? row.series_id ?? fallback.seriesId,
    seasonNumber: row.seasonNumber ?? row.season_number ?? fallback.seasonNumber,
    episodeNumber: row.episodeNumber ?? row.episode_number ?? fallback.episodeNumber,
    title: row.title,
    description: row.description ?? "",
    durationSeconds: row.durationSeconds ?? row.duration_seconds ?? fallback.durationMinutes * 60,
    mediaUrl: row.mediaUrl ?? row.media_url ?? "",
    progress: row.progress ?? 0
  };
}

function mapImportResponse(row: ImportResponse, fallbackTitle: string): AdminImportJob {
  if (row.job) {
    return {
      id: row.job.id,
      title: row.job.source_filename ?? fallbackTitle,
      status: row.job.status === "done" ? "completed" : row.job.status === "pending" ? "queued" : (row.job.status as AdminImportJob["status"]),
      result: row.job.error_message ?? `解析 ${row.job.parsed_lines} 行字幕`,
      createdAt: new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(row.job.created_at))
    };
  }

  return {
    id: row.id ?? fallbackTitle,
    title: row.title ?? fallbackTitle,
    status: row.status ?? "failed",
    result: row.result ?? `解析 ${row.lines?.length ?? 0} 行字幕`,
    createdAt: "刚刚"
  };
}

function mapSubtitleLineResponse(row: SubtitleLineResponse): SubtitleLine {
  return {
    id: row.id,
    episodeId: row.episodeId ?? row.episode_id ?? "",
    lineIndex: row.lineIndex ?? row.line_index ?? 0,
    startMs: row.startMs ?? row.start_ms ?? 0,
    endMs: row.endMs ?? row.end_ms ?? 0,
    englishText: row.englishText ?? row.english_text ?? "",
    chineseText: row.chineseText ?? row.chinese_text ?? "",
    difficulty: row.difficulty ?? "",
    keywords: row.keywords ?? []
  };
}

function nextEpisodeNumber(series?: Series) {
  if (!series || series.episodes.length === 0) {
    return 1;
  }

  return Math.max(...series.episodes.map((episode) => episode.episodeNumber)) + 1;
}

function sortEpisodesForAdmin(episodes: Episode[]) {
  return [...episodes].sort((left, right) => left.seasonNumber - right.seasonNumber || left.episodeNumber - right.episodeNumber || left.title.localeCompare(right.title, "zh-CN"));
}

function getMediaPathTemplate(
  source: MediaSource,
  episode: { seasonNumber: number; episodeNumber: number; title: string }
) {
  const season = String(episode.seasonNumber || 1).padStart(2, "0");
  const episodeNumber = String(episode.episodeNumber || 1).padStart(2, "0");
  const stem = slugifyPathPart(episode.title) || `s${season}e${episodeNumber}`;

  if (source === "url") {
    return `https://example.com/s${season}/${stem}.mp4`;
  }

  if (source === "mock") {
    return `/api/mock-media/campus/${stem}.mp4`;
  }

  return `local/s${season}/${stem}.mp4`;
}

function slugifyPathPart(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function splitKeywords(value: string) {
  return value
    .split(",")
    .map((word) => word.trim())
    .filter(Boolean);
}

function MetricTile({
  label,
  value,
  icon: Icon,
  tone
}: {
  label: string;
  value: string;
  icon: typeof Database;
  tone: "ink" | "green" | "amber" | "red";
}) {
  const color = {
    ink: "text-[color:var(--ink)]",
    green: "text-[color:var(--green)]",
    amber: "text-[color:var(--amber)]",
    red: "text-[color:var(--red)]"
  }[tone];

  return (
    <div className="rounded-md border border-[color:var(--line)] bg-[color:var(--panel)] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-[color:var(--muted)]">{label}</p>
          <p className={cn("sentence-font mt-1 text-3xl font-bold", color)}>{value}</p>
        </div>
        <Icon className={cn("h-5 w-5", color)} aria-hidden="true" />
      </div>
    </div>
  );
}

function ModuleButton({
  active,
  onClick,
  icon: Icon,
  label,
  meta
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof FileUp;
  label: string;
  meta: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-14 items-center gap-3 rounded-md border border-[color:var(--line)] px-3 py-2 text-left transition hover:border-[color:var(--ink)]",
        active && "border-[color:var(--ink)] bg-white"
      )}
    >
      <Icon className="h-5 w-5 shrink-0 text-[color:var(--amber)]" aria-hidden="true" />
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold">{label}</span>
        <span className="block truncate text-xs text-[color:var(--muted)]">{meta}</span>
      </span>
    </button>
  );
}

function PanelButton({
  active,
  onClick,
  icon: Icon,
  label
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Plus;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("flex h-11 items-center justify-center gap-2 rounded-md border border-[color:var(--line)] text-sm font-semibold", active && "ink-action border-[color:var(--ink)]")}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {label}
    </button>
  );
}

function StatusBadge({ label }: { label: string }) {
  return <span className="shrink-0 rounded border border-[color:var(--line)] px-2 py-1 text-xs font-semibold text-[color:var(--muted)]">{label}</span>;
}

function ContentIconButton({
  icon: Icon,
  label,
  onClick,
  active,
  disabled,
  tone = "neutral"
}: {
  icon: typeof Pencil;
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  tone?: "neutral" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={cn(
        "grid h-9 w-9 place-items-center rounded-md border border-[color:var(--line)] bg-white/55 transition hover:border-[color:var(--ink)] disabled:cursor-not-allowed disabled:opacity-50",
        active && "border-[color:var(--ink)] bg-white",
        tone === "danger" && "text-[color:var(--red)] hover:border-[color:var(--red)]"
      )}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}

function SubmitButton({ disabled, label }: { disabled: boolean; label: string }) {
  return (
    <button disabled={disabled} className="ink-action mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60">
      <Save className="h-4 w-4" aria-hidden="true" />
      {disabled ? "处理中" : label}
    </button>
  );
}

function AdvancedFields({ children }: { children: React.ReactNode }) {
  return (
    <details className="rounded-md border border-[color:var(--line)] bg-white/40 p-3">
      <summary className="cursor-pointer text-sm font-semibold text-[color:var(--muted)]">更多字段</summary>
      <div className="mt-3 grid gap-3">{children}</div>
    </details>
  );
}

function ToggleField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex min-h-11 items-center justify-between gap-3 rounded-md border border-[color:var(--line)] bg-white/40 px-3 py-2 text-sm font-semibold">
      {label}
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-5 w-5 accent-[color:var(--green)]" />
    </label>
  );
}

function TextField({
  label,
  value,
  required,
  onChange
}: {
  label: string;
  value: string;
  required?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid min-w-0 gap-2 text-sm font-semibold">
      {label}
      <input value={value} required={required} onChange={(event) => onChange(event.target.value)} className="h-10 w-full min-w-0 rounded-md border border-[color:var(--line)] bg-white/70 px-3 outline-none focus:border-[color:var(--ink)]" />
    </label>
  );
}

function ComboField({
  label,
  value,
  options,
  required,
  onChange
}: {
  label: string;
  value: string;
  options: string[];
  required?: boolean;
  onChange: (value: string) => void;
}) {
  const listId = `${label.replace(/\s+/g, "-")}-options`;

  return (
    <label className="grid min-w-0 gap-2 text-sm font-semibold">
      {label}
      <input
        list={listId}
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full min-w-0 rounded-md border border-[color:var(--line)] bg-white/70 px-3 outline-none focus:border-[color:var(--ink)]"
      />
      <datalist id={listId}>
        {options.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
    </label>
  );
}

function SecretField({
  label,
  value,
  configured,
  onChange
}: {
  label: string;
  value: string;
  configured: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid min-w-0 gap-2 text-sm font-semibold md:col-span-2">
      <span className="flex flex-wrap items-center gap-2">
        {label}
        <span className="rounded border border-[color:var(--line)] px-2 py-0.5 text-xs font-semibold text-[color:var(--muted)]">
          {configured ? "已配置" : "未配置"}
        </span>
      </span>
      <input
        type="password"
        value={value}
        placeholder={configured ? "填写新 key 后保存会覆盖当前配置" : "填写查词服务 API Key"}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full min-w-0 rounded-md border border-[color:var(--line)] bg-white/70 px-3 outline-none focus:border-[color:var(--ink)]"
      />
    </label>
  );
}

function NumberField({
  label,
  value,
  min,
  onChange
}: {
  label: string;
  value: number;
  min?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="grid min-w-0 gap-2 text-sm font-semibold">
      {label}
      <input type="number" min={min} value={value} onChange={(event) => onChange(Number(event.target.value))} className="h-10 w-full min-w-0 rounded-md border border-[color:var(--line)] bg-white/70 px-3 outline-none focus:border-[color:var(--ink)]" />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  children
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="grid min-w-0 gap-2 text-sm font-semibold">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-full min-w-0 rounded-md border border-[color:var(--line)] bg-white/70 px-3 outline-none focus:border-[color:var(--ink)]">
        {children}
      </select>
    </label>
  );
}

function TextArea({
  label,
  value,
  rows = 3,
  required,
  onChange
}: {
  label: string;
  value: string;
  rows?: number;
  required?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid min-w-0 gap-2 text-sm font-semibold">
      {label}
      <textarea
        value={value}
        rows={rows}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        className="w-full min-w-0 resize-y rounded-md border border-[color:var(--line)] bg-white/70 px-3 py-2 text-sm leading-6 outline-none focus:border-[color:var(--ink)]"
      />
    </label>
  );
}
