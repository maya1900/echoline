"use client";

import { useEffect, useMemo, useState } from "react";
import { FileUp, Film, ListChecks, Plus, Save, ShieldCheck } from "lucide-react";
import type { AdminImportJob, Episode, Series, SubtitleLine } from "@/lib/types";
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

const statusText = {
  queued: "排队中",
  processing: "处理中",
  completed: "已完成",
  failed: "失败"
};

const defaultSubtitleText = `1
00:00:01,000 --> 00:00:03,200
I left the spare key on the table.
我把备用钥匙放在桌上了。

2
00:00:03,500 --> 00:00:06,000
Could you bring it downstairs?
你能把它拿到楼下吗？`;

export function AdminWorkbench({
  initialSeries,
  initialJobs
}: {
  initialSeries: Series[];
  initialJobs: AdminImportJob[];
}) {
  const [series, setSeries] = useState(initialSeries);
  const [jobs, setJobs] = useState(initialJobs);
  const [activePanel, setActivePanel] = useState<"series" | "episode" | "subtitles" | "editor">("series");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    subtitleText: defaultSubtitleText
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

  useEffect(() => {
    if (activePanel === "editor" && editorEpisodeId) {
      void loadSubtitleLines(editorEpisodeId);
    }
  }, [activePanel, editorEpisodeId]);

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
    const response = await postJson<SeriesResponse>("/api/admin/series", seriesForm);

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
    const response = await postJson<ImportResponse>("/api/admin/import-subtitles", subtitleForm);

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
        keywords: lineForm.keywords
          .split(",")
          .map((word) => word.trim())
          .filter(Boolean)
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
                keywords: lineForm.keywords
                  .split(",")
                  .map((word) => word.trim())
                  .filter(Boolean)
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

  return (
    <section className="grid gap-4 lg:grid-cols-[380px_1fr]">
      <aside className="space-y-4">
        <div className="rounded-md border border-[color:var(--line)] bg-[color:var(--panel)] p-4">
          <div className="mb-4 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-[color:var(--green)]" aria-hidden="true" />
            <h2 className="text-xl font-bold">导入入口</h2>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <PanelButton active={activePanel === "series"} onClick={() => setActivePanel("series")} icon={Plus} label="剧集" />
            <PanelButton active={activePanel === "episode"} onClick={() => setActivePanel("episode")} icon={Film} label="集数" />
            <PanelButton active={activePanel === "subtitles"} onClick={() => setActivePanel("subtitles")} icon={FileUp} label="字幕" />
            <PanelButton active={activePanel === "editor"} onClick={() => setActivePanel("editor")} icon={ListChecks} label="编辑" />
          </div>
          {message ? <p className="mt-3 rounded-md border border-[color:var(--line)] bg-white/60 p-3 text-sm text-[color:var(--muted)]">{message}</p> : null}
        </div>

        {activePanel === "series" ? (
          <form onSubmit={submitSeries} className="rounded-md border border-[color:var(--line)] bg-[color:var(--panel)] p-4">
            <h3 className="font-bold">新建剧集</h3>
            <div className="mt-4 grid gap-3">
              <TextField label="中文名" value={seriesForm.title} required onChange={(value) => setSeriesForm((current) => ({ ...current, title: value }))} />
              <TextField label="英文名" value={seriesForm.originalTitle} onChange={(value) => setSeriesForm((current) => ({ ...current, originalTitle: value }))} />
              <TextArea label="简介" value={seriesForm.description} onChange={(value) => setSeriesForm((current) => ({ ...current, description: value }))} />
              <TextField label="封面 URL" value={seriesForm.coverUrl} onChange={(value) => setSeriesForm((current) => ({ ...current, coverUrl: value }))} />
              <div className="grid grid-cols-2 gap-3">
                <TextField label="难度" value={seriesForm.difficulty} required onChange={(value) => setSeriesForm((current) => ({ ...current, difficulty: value }))} />
                <TextField label="题材" value={seriesForm.genre} required onChange={(value) => setSeriesForm((current) => ({ ...current, genre: value }))} />
              </div>
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
              <div className="grid grid-cols-3 gap-3">
                <NumberField label="季" value={episodeForm.seasonNumber} min={1} onChange={(value) => setEpisodeForm((current) => ({ ...current, seasonNumber: value }))} />
                <NumberField label="集" value={episodeForm.episodeNumber} min={1} onChange={(value) => setEpisodeForm((current) => ({ ...current, episodeNumber: value }))} />
                <NumberField label="分钟" value={episodeForm.durationMinutes} min={1} onChange={(value) => setEpisodeForm((current) => ({ ...current, durationMinutes: value }))} />
              </div>
              <TextField label="标题" value={episodeForm.title} required onChange={(value) => setEpisodeForm((current) => ({ ...current, title: value }))} />
              <TextArea label="简介" value={episodeForm.description} onChange={(value) => setEpisodeForm((current) => ({ ...current, description: value }))} />
              <TextField label="媒体路径" value={episodeForm.mediaUrl} onChange={(value) => setEpisodeForm((current) => ({ ...current, mediaUrl: value }))} />
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
              <TextField label="文件名" value={subtitleForm.sourceFilename} required onChange={(value) => setSubtitleForm((current) => ({ ...current, sourceFilename: value }))} />
              <TextArea label="SRT / VTT" value={subtitleForm.subtitleText} rows={10} required onChange={(value) => setSubtitleForm((current) => ({ ...current, subtitleText: value }))} />
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
                    <span className="mb-1 block text-xs text-[color:var(--muted)]">第 {line.lineIndex} 句 · {line.startMs}ms</span>
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

      <div className="grid gap-4">
        <section className="rounded-md border border-[color:var(--line)] bg-[color:var(--panel)] p-5">
          <h2 className="text-xl font-bold">已导入内容</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {series.map((item) => (
              <article key={item.id} className="rounded-md border border-[color:var(--line)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate font-bold">{item.title}</h3>
                    <p className="mt-1 text-sm text-[color:var(--muted)]">{item.episodes.length} 集 · {item.difficulty}</p>
                  </div>
                  <span className="shrink-0 rounded border border-[color:var(--line)] px-2 py-1 text-xs font-semibold text-[color:var(--muted)]">{item.genre}</span>
                </div>
                <div className="mt-3 h-2 rounded-full bg-black/10">
                  <div className="h-2 rounded-full bg-[color:var(--amber)]" style={{ width: `${item.progress}%` }} />
                </div>
                <div className="mt-3 space-y-2">
                  {item.episodes.slice(0, 3).map((episode) => (
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
                  <span className="rounded border border-[color:var(--line)] px-2 py-1 text-xs font-semibold text-[color:var(--muted)]">{statusText[job.status]}</span>
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
    id: row.id ?? `job-${Date.now()}`,
    title: row.title ?? fallbackTitle,
    status: row.status ?? "completed",
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

function SubmitButton({ disabled, label }: { disabled: boolean; label: string }) {
  return (
    <button disabled={disabled} className="ink-action mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60">
      <Save className="h-4 w-4" aria-hidden="true" />
      {disabled ? "处理中" : label}
    </button>
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
