"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BookOpenCheck,
  Database,
  FileUp,
  Film,
  KeyRound,
  ListChecks,
  Lock,
  Plus,
  Save,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  UserCog,
  Users
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

type AdminModule = "imports" | "users" | "permissions" | "settings";
type ImportPanel = "series" | "episode" | "subtitles" | "editor";

const statusText = {
  queued: "排队中",
  processing: "处理中",
  completed: "已完成",
  failed: "失败"
};

const defaultCoverUrl = "https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=1200&q=80";

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

  const episodes = useMemo(() => series.flatMap((item) => item.episodes.map((episode) => ({ ...episode, seriesTitle: item.title }))), [series]);
  const totalEpisodes = episodes.length;
  const adminCount = users.filter((user) => user.role === "admin").length;
  const latestJob = jobs[0];

  useEffect(() => {
    if (activeModule === "imports" && activePanel === "editor" && editorEpisodeId) {
      void loadSubtitleLines(editorEpisodeId);
    }
  }, [activeModule, activePanel, editorEpisodeId]);

  function updateEpisodeSeries(seriesId: string) {
    const targetSeries = series.find((item) => item.id === seriesId);
    setEpisodeForm((current) => ({
      ...current,
      seriesId,
      episodeNumber: nextEpisodeNumber(targetSeries)
    }));
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
        description: ""
      }));
      setMessage("集数已创建");
    } else {
      setMessage("集数创建失败");
    }

    setIsSubmitting(false);
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
      setMessage("字幕已导入");
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

    if (response?.ok) {
      setSubtitleLines((current) =>
        current.map((line) =>
          line.id === selectedLineId
            ? {
                ...line,
                englishText: lineForm.englishText,
                chineseText: lineForm.chineseText,
                startMs: lineForm.startMs,
                endMs: lineForm.endMs,
                difficulty: lineForm.difficulty,
                keywords: splitKeywords(lineForm.keywords)
              }
            : line
        )
      );
      setMessage("字幕已保存");
    } else {
      setMessage("字幕保存失败");
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
      body: JSON.stringify(settings)
    }).catch(() => null);
    const payload = response ? ((await response.json().catch(() => null)) as { data?: SiteSettings; error?: string } | null) : null;

    if (response?.ok && payload?.data) {
      setSettings(payload.data);
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
            <div className="grid grid-cols-4 gap-2">
              <PanelButton active={activePanel === "series"} onClick={() => setActivePanel("series")} icon={Plus} label="剧集" />
              <PanelButton active={activePanel === "episode"} onClick={() => setActivePanel("episode")} icon={Film} label="集数" />
              <PanelButton active={activePanel === "subtitles"} onClick={() => setActivePanel("subtitles")} icon={FileUp} label="字幕" />
              <PanelButton active={activePanel === "editor"} onClick={() => setActivePanel("editor")} icon={ListChecks} label="编辑" />
            </div>
          </div>

          {activePanel === "series" ? (
            <form onSubmit={submitSeries} className="rounded-md border border-[color:var(--line)] bg-[color:var(--panel)] p-4">
              <h3 className="font-bold">新建剧集</h3>
              <div className="mt-4 grid gap-3">
                <TextField label="剧名" value={seriesForm.title} required onChange={(value) => setSeriesForm((current) => ({ ...current, title: value }))} />
                <div className="grid grid-cols-2 gap-3">
                  <TextField label="难度" value={seriesForm.difficulty} required onChange={(value) => setSeriesForm((current) => ({ ...current, difficulty: value }))} />
                  <TextField label="题材" value={seriesForm.genre} required onChange={(value) => setSeriesForm((current) => ({ ...current, genre: value }))} />
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
                <TextField label="媒体路径" value={episodeForm.mediaUrl} onChange={(value) => setEpisodeForm((current) => ({ ...current, mediaUrl: value }))} />
                <AdvancedFields>
                  <div className="grid grid-cols-3 gap-3">
                    <NumberField label="季" value={episodeForm.seasonNumber} min={1} onChange={(value) => setEpisodeForm((current) => ({ ...current, seasonNumber: value }))} />
                    <NumberField label="集" value={episodeForm.episodeNumber} min={1} onChange={(value) => setEpisodeForm((current) => ({ ...current, episodeNumber: value }))} />
                    <NumberField label="分钟" value={episodeForm.durationMinutes} min={1} onChange={(value) => setEpisodeForm((current) => ({ ...current, durationMinutes: value }))} />
                  </div>
                  <TextArea label="简介" value={episodeForm.description} onChange={(value) => setEpisodeForm((current) => ({ ...current, description: value }))} />
                </AdvancedFields>
              </div>
              <SubmitButton disabled={isSubmitting || !episodeForm.seriesId} label="创建集数" />
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
          <section className="rounded-md border border-[color:var(--line)] bg-[color:var(--panel)] p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">已导入内容</h2>
                <p className="mt-1 text-sm text-[color:var(--muted)]">{totalEpisodes} 个片段可用于学习</p>
              </div>
              {latestJob ? <StatusBadge label={statusText[latestJob.status]} /> : null}
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {series.map((item) => (
                <article key={item.id} className="rounded-md border border-[color:var(--line)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate font-bold">{item.title}</h3>
                      <p className="mt-1 text-sm text-[color:var(--muted)]">
                        {item.episodes.length} 集 · {item.difficulty}
                      </p>
                    </div>
                    <span className="shrink-0 rounded border border-[color:var(--line)] px-2 py-1 text-xs font-semibold text-[color:var(--muted)]">{item.genre}</span>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-black/10">
                    <div className="h-2 rounded-full bg-[color:var(--amber)]" style={{ width: `${item.progress}%` }} />
                  </div>
                  <div className="mt-3 space-y-2">
                    {item.episodes.slice(0, 4).map((episode) => (
                      <div key={episode.id} className="rounded border border-[color:var(--line)] px-3 py-2 text-sm">
                        S{episode.seasonNumber}E{episode.episodeNumber} · {episode.title}
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="rounded-md border border-[color:var(--line)] bg-[color:var(--panel)] p-5">
            <h2 className="text-xl font-bold">导入任务</h2>
            <div className="mt-4 space-y-3">
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
            <div className="grid gap-3 sm:grid-cols-3">
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
              <TextField label="字典 Provider" value={settings.dictionaryProvider} required onChange={(value) => setSettings((current) => ({ ...current, dictionaryProvider: value }))} />
              <TextField label="字典模型" value={settings.dictionaryModel} required onChange={(value) => setSettings((current) => ({ ...current, dictionaryModel: value }))} />
            </div>
          </section>
        </div>
      </form>
    );
  }
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

function nextEpisodeNumber(series?: Series) {
  if (!series || series.episodes.length === 0) {
    return 1;
  }

  return Math.max(...series.episodes.map((episode) => episode.episodeNumber)) + 1;
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
    <label className="grid gap-2 text-sm font-semibold">
      {label}
      <input value={value} required={required} onChange={(event) => onChange(event.target.value)} className="h-10 rounded-md border border-[color:var(--line)] bg-white/70 px-3 outline-none focus:border-[color:var(--ink)]" />
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
    <label className="grid gap-2 text-sm font-semibold">
      {label}
      <input type="number" min={min} value={value} onChange={(event) => onChange(Number(event.target.value))} className="h-10 rounded-md border border-[color:var(--line)] bg-white/70 px-3 outline-none focus:border-[color:var(--ink)]" />
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
    <label className="grid gap-2 text-sm font-semibold">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-10 rounded-md border border-[color:var(--line)] bg-white/70 px-3 outline-none focus:border-[color:var(--ink)]">
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
    <label className="grid gap-2 text-sm font-semibold">
      {label}
      <textarea
        value={value}
        rows={rows}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        className="resize-y rounded-md border border-[color:var(--line)] bg-white/70 px-3 py-2 text-sm leading-6 outline-none focus:border-[color:var(--ink)]"
      />
    </label>
  );
}
