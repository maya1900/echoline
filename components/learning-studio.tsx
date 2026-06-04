"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { BookOpen, ChevronLeft, ChevronRight, Eye, EyeOff, ListVideo, Mic, Pause, Play, Repeat, RotateCcw, Volume2 } from "lucide-react";
import type { DictionaryEntry, Episode, LearningMode, RepeatAttempt, Series, SubtitleLine } from "@/lib/types";
import { cn, msToClock } from "@/lib/utils";

const modes: { id: LearningMode; label: string }[] = [
  { id: "rough", label: "粗听" },
  { id: "intensive", label: "精听" },
  { id: "loop", label: "逐句循环" },
  { id: "repeat", label: "跟读" },
  { id: "call_response", label: "接下一句" }
];

export function LearningStudio({
  episode,
  parentSeries,
  lines
}: {
  episode: Episode;
  parentSeries: Series;
  lines: SubtitleLine[];
}) {
  const mediaRef = useRef<HTMLVideoElement>(null);
  const [mode, setMode] = useState<LearningMode>("intensive");
  const [lineIndex, setLineIndex] = useState(0);
  const [showEnglish, setShowEnglish] = useState(true);
  const [showChinese, setShowChinese] = useState(true);
  const [speed, setSpeed] = useState(0.9);
  const [loopCount, setLoopCount] = useState(3);
  const [maskBurnedSubtitles, setMaskBurnedSubtitles] = useState(true);
  const [maskHeight, setMaskHeight] = useState(11);
  const [maskBottom, setMaskBottom] = useState(15);
  const [isPlaying, setIsPlaying] = useState(false);
  const [mediaUrl, setMediaUrl] = useState(episode.mediaUrl);
  const [mediaError, setMediaError] = useState("");
  const [loopPass, setLoopPass] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [attempt, setAttempt] = useState<RepeatAttempt | null>(null);
  const [attemptStatus, setAttemptStatus] = useState("");
  const [lookupWord, setLookupWord] = useState<string | null>(null);
  const [lookup, setLookup] = useState<DictionaryEntry | null>(null);
  const [lookupStatus, setLookupStatus] = useState("");
  const [vocabStatus, setVocabStatus] = useState("");

  const current = lines[lineIndex] ?? lines[0];
  const previous = lines[lineIndex - 1];
  const next = lines[lineIndex + 1];

  const visibleLine = useMemo(() => {
    if (mode === "call_response" && !attempt) {
      return previous ?? current;
    }
    return current;
  }, [attempt, current, mode, previous]);

  useEffect(() => {
    let active = true;

    async function loadMediaUrl() {
      setMediaError("");
      const response = await fetch(`/api/episodes/${episode.id}/media-url`).catch(() => null);
      const payload = response ? ((await response.json().catch(() => null)) as { data?: { mediaUrl?: string } } | null) : null;

      if (active) {
        setMediaUrl(payload?.data?.mediaUrl ?? episode.mediaUrl);
      }
    }

    void loadMediaUrl();
    return () => {
      active = false;
    };
  }, [episode.id, episode.mediaUrl]);

  useEffect(() => {
    if (mediaRef.current) {
      mediaRef.current.playbackRate = speed;
    }
  }, [speed]);

  useEffect(() => {
    const stored = window.localStorage.getItem(`subtitle-mask:${episode.id}`);

    if (!stored) {
      setMaskHeight(11);
      setMaskBottom(15);
      return;
    }

    try {
      const parsed = JSON.parse(stored) as Partial<{ height: number; bottom: number }>;
      setMaskHeight(typeof parsed.height === "number" ? parsed.height : 11);
      setMaskBottom(typeof parsed.bottom === "number" ? parsed.bottom : 15);
    } catch {
      setMaskHeight(11);
      setMaskBottom(15);
    }
  }, [episode.id]);

  useEffect(() => {
    setLoopPass(0);
    const media = mediaRef.current;

    if (media && mode !== "rough") {
      media.currentTime = current.startMs / 1000;
    }
  }, [current.startMs, mode]);

  useEffect(() => {
    let active = true;

    async function loadDefinition() {
      if (!lookupWord) {
        setLookup(null);
        setLookupStatus("");
        setVocabStatus("");
        return;
      }

      setLookup(null);
      setLookupStatus("查询中");
      setVocabStatus("");
      const params = new URLSearchParams({
        word: lookupWord,
        englishSentence: current.englishText,
        chineseSentence: current.chineseText
      });
      const response = await fetch(`/api/define?${params.toString()}`).catch(() => null);
      const payload = response ? ((await response.json().catch(() => null)) as { data?: DictionaryEntry } | null) : null;

      if (active) {
        setLookup(payload?.data ?? null);
        setLookupStatus(payload?.data ? "" : "暂无释义");
      }
    }

    void loadDefinition();
    return () => {
      active = false;
    };
  }, [current.chineseText, current.englishText, lookupWord]);

  async function saveProgress(line: SubtitleLine, options: { completed?: boolean; repeatCount?: number; bestScore?: number } = {}) {
    await fetch("/api/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        seriesId: parentSeries.id,
        episodeId: episode.id,
        subtitleLineId: line.id,
        mode,
        playbackPositionMs: line.endMs,
        completed: options.completed ?? false,
        repeatCount: options.repeatCount ?? 0,
        bestScore: options.bestScore
      })
    }).catch(() => undefined);
  }

  function seekToLine(line: SubtitleLine) {
    const media = mediaRef.current;

    if (media && mode !== "rough") {
      media.currentTime = line.startMs / 1000;
    }
  }

  function move(delta: number) {
    const nextIndex = Math.min(Math.max(lineIndex + delta, 0), lines.length - 1);

    if (delta > 0) {
      void saveProgress(current, { completed: true });
    }
    setAttempt(null);
    setLookupWord(null);
    setLineIndex(nextIndex);
    seekToLine(lines[nextIndex]);
  }

  async function togglePlayback() {
    const media = mediaRef.current;

    if (!media) {
      setIsPlaying((value) => !value);
      return;
    }

    if (isPlaying) {
      media.pause();
      return;
    }

    if (mode !== "rough") {
      const currentMs = media.currentTime * 1000;
      if (currentMs < current.startMs || currentMs >= current.endMs) {
        media.currentTime = current.startMs / 1000;
      }
    }

    media.playbackRate = speed;

    try {
      await media.play();
      setMediaError("");
    } catch {
      setMediaError("当前媒体不可播放，请检查媒体文件或 Supabase Storage 签名。");
      setIsPlaying(false);
    }
  }

  function handleTimeUpdate() {
    const media = mediaRef.current;

    if (!media || mode === "rough") {
      return;
    }

    const currentMs = media.currentTime * 1000;

    if (currentMs < current.endMs) {
      return;
    }

    if (mode === "loop" && loopPass + 1 < loopCount) {
      setLoopPass((value) => value + 1);
      media.currentTime = current.startMs / 1000;
      void media.play().catch(() => undefined);
      return;
    }

    media.pause();
    setIsPlaying(false);
    void saveProgress(current, { completed: true, repeatCount: mode === "loop" ? loopCount : 0 });
  }

  async function saveVocab() {
    if (!lookupWord || !current) {
      return;
    }

    setVocabStatus("收藏中");
    const response = await fetch("/api/vocab", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        word: lookupWord.toLowerCase(),
        phonetic: lookup?.phonetic ?? "",
        translation: lookup?.translation ?? "",
        contextSentence: current.englishText,
        episodeId: episode.id,
        subtitleLineId: current.id
      })
    }).catch(() => null);

    setVocabStatus(response?.ok ? "已收藏" : "收藏失败");
  }

  async function submitRecording() {
    setIsRecording(false);
    setAttemptStatus("评分中");
    const response = await fetch("/api/attempts/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode,
        targetText: current.englishText,
        episodeId: episode.id,
        subtitleLineId: current.id
      })
    }).catch(() => null);
    const payload = response ? ((await response.json().catch(() => null)) as { data?: RepeatAttempt; error?: string } | null) : null;
    const nextAttempt = payload?.data;

    if (nextAttempt) {
      setAttempt(nextAttempt);
      setAttemptStatus("");
      void saveProgress(current, { completed: true, repeatCount: 1, bestScore: nextAttempt.overall });
      return;
    }

    setAttemptStatus(payload?.error === "Repeat scoring service is not connected yet" ? "评分服务未接入" : "评分失败");
  }

  function updateMaskSettings(next: Partial<{ height: number; bottom: number }>) {
    const height = next.height ?? maskHeight;
    const bottom = next.bottom ?? maskBottom;

    setMaskHeight(height);
    setMaskBottom(bottom);
    window.localStorage.setItem(`subtitle-mask:${episode.id}`, JSON.stringify({ height, bottom }));
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <section className="space-y-4">
        <div className="overflow-hidden rounded-md border border-[color:var(--ink)] bg-[color:var(--panel)]">
          <div className="relative aspect-video min-h-[420px] overflow-hidden bg-black text-white lg:min-h-[560px]">
            {!mediaUrl ? <img src={parentSeries.coverUrl} alt={parentSeries.title} className="absolute inset-0 h-full w-full object-cover opacity-60" /> : null}
            {mediaUrl ? (
              <video
                ref={mediaRef}
                src={mediaUrl}
                className="absolute inset-0 h-full w-full bg-black object-contain"
                playsInline
                preload="metadata"
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => setIsPlaying(false)}
                onTimeUpdate={handleTimeUpdate}
                onError={() => {
                  setMediaError("媒体文件暂不可播放，仍可使用字幕练习。");
                  setIsPlaying(false);
                }}
              />
            ) : null}
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.36),rgba(0,0,0,0.02)_32%,rgba(0,0,0,0.44))]" />
            {maskBurnedSubtitles ? (
              <div
                className="pointer-events-none absolute inset-x-0 z-10 border-y border-white/10 bg-black"
                style={{ bottom: `${maskBottom}%`, height: `${maskHeight}%` }}
                aria-hidden="true"
              />
            ) : null}
            <div className="relative z-20 flex h-full min-h-[420px] flex-col justify-between p-5 sm:p-6 lg:min-h-[560px]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-white/70">
                    {parentSeries.title} · S{episode.seasonNumber}E{episode.episodeNumber}
                  </p>
                  <h1 className="mt-1 text-2xl font-bold">{episode.title}</h1>
                </div>
                <span className="rounded-md border border-white/20 px-3 py-1 text-sm">{msToClock(current.startMs)} - {msToClock(current.endMs)}</span>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2">
                <button onClick={() => move(-1)} className="grid h-11 w-11 place-items-center rounded-md border border-white/20 bg-white/10" aria-label="上一句">
                  <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                </button>
                <button onClick={togglePlayback} className="flex h-11 min-w-32 items-center justify-center gap-2 rounded-md bg-[color:var(--paper)] px-4 font-semibold text-[color:var(--ink)]">
                  {isPlaying ? <Pause className="h-4 w-4" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
                  {isPlaying ? "暂停" : "播放"}
                </button>
                <button onClick={() => move(1)} className="grid h-11 w-11 place-items-center rounded-md border border-white/20 bg-white/10" aria-label="下一句">
                  <ChevronRight className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
              {mediaError ? <p className="mt-3 text-center text-sm text-white/75">{mediaError}</p> : null}
            </div>
          </div>

          <div className="border-t border-[color:var(--ink)] bg-[color:var(--paper)] px-4 py-4 sm:px-5">
            <div className="mx-auto max-w-5xl text-center">
              {mode === "call_response" && !attempt ? <p className="mb-2 text-sm font-semibold text-[color:var(--amber)]">听上一句，然后接下一句</p> : null}
              {showEnglish ? (
                <p className="sentence-font text-2xl font-bold leading-snug sm:text-3xl">
                  {renderClickableWords(visibleLine.englishText, setLookupWord, attempt?.missedWords)}
                </p>
              ) : (
                <p className="sentence-font text-2xl font-bold leading-snug sm:text-3xl">••••••</p>
              )}
              {showChinese ? <p className="mt-2 text-base leading-7 text-[color:var(--muted)] sm:text-lg">{visibleLine.chineseText}</p> : null}
            </div>
          </div>

          <div className="border-t border-[color:var(--line)] p-4">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {modes.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setMode(item.id);
                    setAttempt(null);
                    setAttemptStatus("");
                  }}
                  className={cn(
                    "h-10 shrink-0 rounded-md border border-[color:var(--line)] px-3 text-sm font-semibold",
                    mode === item.id && "ink-action border-[color:var(--ink)]"
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <ControlToggle active={showEnglish} onClick={() => setShowEnglish((value) => !value)} icon={showEnglish ? Eye : EyeOff} label="英文字幕" />
              <ControlToggle active={showChinese} onClick={() => setShowChinese((value) => !value)} icon={showChinese ? Eye : EyeOff} label="中文字幕" />
              <ControlToggle active={maskBurnedSubtitles} onClick={() => setMaskBurnedSubtitles((value) => !value)} icon={maskBurnedSubtitles ? EyeOff : Eye} label="遮挡硬字幕" />
              <label className="rounded-md border border-[color:var(--line)] p-3 text-sm">
                <span className="mb-2 flex items-center gap-2 font-semibold">
                  <Volume2 className="h-4 w-4" aria-hidden="true" />
                  速度 {speed.toFixed(1)}x
                </span>
                <input type="range" min="0.5" max="1.25" step="0.05" value={speed} onChange={(event) => setSpeed(Number(event.target.value))} className="w-full accent-[color:var(--green)]" />
              </label>
              <label className="rounded-md border border-[color:var(--line)] p-3 text-sm">
                <span className="mb-2 flex items-center gap-2 font-semibold">
                  <Repeat className="h-4 w-4" aria-hidden="true" />
                  循环 {loopCount} 次
                </span>
                <input type="range" min="1" max="8" step="1" value={loopCount} onChange={(event) => setLoopCount(Number(event.target.value))} className="w-full accent-[color:var(--amber)]" />
              </label>
              <label className="rounded-md border border-[color:var(--line)] p-3 text-sm">
                <span className="mb-2 flex items-center gap-2 font-semibold">
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                  遮挡高度 {maskHeight}%
                </span>
                <input type="range" min="6" max="22" step="1" value={maskHeight} onChange={(event) => updateMaskSettings({ height: Number(event.target.value) })} className="w-full accent-[color:var(--red)]" />
              </label>
              <label className="rounded-md border border-[color:var(--line)] p-3 text-sm">
                <span className="mb-2 flex items-center gap-2 font-semibold">
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                  离底部 {maskBottom}%
                </span>
                <input type="range" min="0" max="34" step="1" value={maskBottom} onChange={(event) => updateMaskSettings({ bottom: Number(event.target.value) })} className="w-full accent-[color:var(--red)]" />
              </label>
            </div>
          </div>
        </div>

        {(mode === "repeat" || mode === "call_response") && (
          <div className="rounded-md border border-[color:var(--line)] bg-[color:var(--panel)] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-bold">{mode === "repeat" ? "跟读录音" : "接下一句录音"}</h2>
                <p className="text-sm text-[color:var(--muted)]">V1 只评估内容准确度和完整度，不展示发音或流利度分。</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setAttempt(null);
                    setAttemptStatus("");
                  }}
                  className="grid h-11 w-11 place-items-center rounded-md border border-[color:var(--line)]"
                  aria-label="重置评分"
                >
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  onClick={() => {
                    if (isRecording) {
                      void submitRecording();
                      return;
                    }

                    setAttemptStatus("");
                    setIsRecording(true);
                  }}
                  className={cn("flex h-11 min-w-36 items-center justify-center gap-2 rounded-md px-4 font-semibold text-white", isRecording ? "bg-[color:var(--red)]" : "bg-[color:var(--green)]")}
                >
                  <Mic className="h-4 w-4" aria-hidden="true" />
                  {isRecording ? "提交录音" : "开始录音"}
                </button>
              </div>
            </div>
            {attempt ? (
              <div className="mt-4 grid gap-3 md:grid-cols-[220px_1fr]">
                <div className="rounded-md border border-[color:var(--line)] p-4">
                  <p className="text-sm text-[color:var(--muted)]">总分</p>
                  <p className="sentence-font mt-1 text-5xl font-bold text-[color:var(--green)]">{attempt.overall}</p>
                  <p className="mt-2 text-sm">准确度 {attempt.accuracy}% · 完整度 {attempt.completeness}%</p>
                </div>
                <div className="rounded-md border border-[color:var(--line)] p-4">
                  <p className="text-sm font-semibold">转写</p>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">{attempt.transcript}</p>
                  <p className="mt-3 text-sm font-semibold">反馈</p>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">{attempt.feedback}</p>
                </div>
              </div>
            ) : null}
            {attemptStatus && !attempt ? <p className="mt-4 rounded-md border border-[color:var(--line)] bg-white/60 p-3 text-sm text-[color:var(--muted)]">{attemptStatus}</p> : null}
          </div>
        )}
      </section>

      <aside className="space-y-4">
        <div className="rounded-md border border-[color:var(--line)] bg-[color:var(--panel)] p-4">
          <div className="flex items-center gap-2">
            <ListVideo className="h-4 w-4 text-[color:var(--amber)]" aria-hidden="true" />
            <h2 className="font-bold">片段</h2>
          </div>
          <div className="quiet-scrollbar mt-3 max-h-56 space-y-2 overflow-y-auto pr-1">
            {parentSeries.episodes.map((item) => (
              <Link
                key={item.id}
                href={`/learn/${item.id}`}
                className={cn(
                  "flex min-h-11 items-center justify-between gap-3 rounded-md border border-[color:var(--line)] px-3 py-2 text-sm transition hover:border-[color:var(--ink)]",
                  item.id === episode.id && "border-[color:var(--ink)] bg-white font-semibold"
                )}
              >
                <span className="min-w-0 truncate">{item.title}</span>
                <Play className="h-3.5 w-3.5 shrink-0 text-[color:var(--amber)]" aria-hidden="true" />
              </Link>
            ))}
          </div>
        </div>

        <div className="rounded-md border border-[color:var(--line)] bg-[color:var(--panel)] p-4">
          <h2 className="font-bold">字幕队列</h2>
          <div className="quiet-scrollbar mt-3 max-h-[440px] space-y-2 overflow-y-auto pr-1">
            {lines.map((line, index) => (
              <button
                key={line.id}
                onClick={() => {
                  void saveProgress(current, { completed: true });
                  setLineIndex(index);
                  setAttempt(null);
                  setLoopPass(0);
                  seekToLine(line);
                }}
                className={cn("w-full rounded-md border border-[color:var(--line)] p-3 text-left text-sm transition hover:border-[color:var(--ink)]", index === lineIndex && "border-[color:var(--ink)] bg-white")}
              >
                <span className="mb-1 block text-xs text-[color:var(--muted)]">
                  {line.lineIndex}. {msToClock(line.startMs)}
                </span>
                <span className="line-clamp-2 font-semibold">{line.englishText}</span>
                <span className="mt-1 line-clamp-1 text-[color:var(--muted)]">{line.chineseText}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-md border border-[color:var(--line)] bg-[color:var(--panel)] p-4">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-[color:var(--green)]" aria-hidden="true" />
            <h2 className="font-bold">查词</h2>
          </div>
          {lookupWord ? (
            <div className="mt-3 rounded-md border border-[color:var(--line)] p-3">
              <p className="text-xl font-bold">{lookupWord}</p>
              <p className="mt-1 text-sm text-[color:var(--muted)]">{lookup?.phonetic ?? "暂无音标"}</p>
              <p className="mt-3 text-base font-semibold leading-6">{lookupStatus || lookup?.translation || "暂无释义"}</p>
              {lookup?.inContext ? (
                <p className="mt-3 rounded-md bg-white/70 p-3 text-sm leading-6">
                  <span className="font-semibold">这句里：</span>
                  {lookup.inContext}
                </p>
              ) : null}
              {lookup?.note ? <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">{lookup.note}</p> : null}
              <button onClick={saveVocab} className="ink-action mt-3 h-10 w-full rounded-md text-sm font-semibold">
                {vocabStatus || "收藏到生词本"}
              </button>
            </div>
          ) : (
            <p className="mt-3 text-sm leading-6 text-[color:var(--muted)]">点击英文字幕里的单词查看释义。</p>
          )}
        </div>
      </aside>
    </div>
  );
}

function ControlToggle({
  active,
  onClick,
  icon: Icon,
  label
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Eye;
  label: string;
}) {
  return (
    <button onClick={onClick} className={cn("flex h-16 items-center gap-3 rounded-md border border-[color:var(--line)] p-3 text-left text-sm", active && "border-[color:var(--ink)] bg-white")}>
      <Icon className="h-4 w-4" aria-hidden="true" />
      <span>
        <span className="block font-semibold">{label}</span>
        <span className="block text-xs text-[color:var(--muted)]">{active ? "显示中" : "已隐藏"}</span>
      </span>
    </button>
  );
}

function renderClickableWords(text: string, onPick: (word: string) => void, missed: string[] = []) {
  const pieces = text.split(/(\b[A-Za-z']+\b)/g);
  return pieces.map((piece, index) => {
    if (!/^[A-Za-z']+$/.test(piece)) {
      return <span key={`${piece}-${index}`}>{piece}</span>;
    }
    const isMissed = missed.includes(piece.toLowerCase());
    return (
      <button
        key={`${piece}-${index}`}
        onClick={() => onPick(piece)}
        className={cn("inline rounded-sm px-1 transition hover:bg-[color:var(--amber)] hover:text-[color:var(--ink)]", isMissed && "bg-[color:var(--red)] text-white")}
      >
        {piece}
      </button>
    );
  });
}
