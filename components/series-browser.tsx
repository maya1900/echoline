"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Clock3, Filter, Play, Search } from "lucide-react";
import type { Series } from "@/lib/types";
import { formatTime } from "@/lib/utils";

export function SeriesBrowser({ items }: { items: Series[] }) {
  const [query, setQuery] = useState("");
  const [difficulty, setDifficulty] = useState("全部");

  const difficulties = ["全部", ...Array.from(new Set(items.map((item) => item.difficulty)))];
  const filtered = useMemo(
    () =>
      items.filter((item) => {
        const matchesText = `${item.title} ${item.originalTitle} ${item.genre}`.toLowerCase().includes(query.toLowerCase());
        const matchesDifficulty = difficulty === "全部" || item.difficulty === difficulty;
        return matchesText && matchesDifficulty;
      }),
    [difficulty, items, query]
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-md border border-[color:var(--line)] bg-[color:var(--panel)] p-4 md:grid-cols-[1fr_220px]">
        <label className="flex h-11 items-center gap-2 rounded-md border border-[color:var(--line)] bg-white/60 px-3">
          <Search className="h-4 w-4 text-[color:var(--muted)]" aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索剧名、题材"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
        </label>
        <label className="flex h-11 items-center gap-2 rounded-md border border-[color:var(--line)] bg-white/60 px-3">
          <Filter className="h-4 w-4 text-[color:var(--muted)]" aria-hidden="true" />
          <select value={difficulty} onChange={(event) => setDifficulty(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm outline-none">
            {difficulties.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {filtered.map((item) => {
          const targetEpisode =
            item.episodes.find((episode) => episode.progress > 0 && episode.progress < 100) ??
            item.episodes.find((episode) => episode.progress < 100) ??
            item.episodes[0];
          const hasProgress = item.progress > 0;
          const actionHref = targetEpisode ? `/learn/${targetEpisode.id}` : "/series";

          return (
            <article key={item.id} className="overflow-hidden rounded-md border border-[color:var(--line)] bg-[color:var(--panel)]">
              <img src={item.coverUrl} alt={`${item.title} 封面`} className="h-56 w-full object-cover" />
              <div className="p-5">
                <div className="flex flex-wrap gap-2 text-xs font-semibold">
                  <span className="ink-action rounded px-2 py-1">{item.difficulty}</span>
                  <span className="rounded border border-[color:var(--line)] px-2 py-1 text-[color:var(--muted)]">{item.genre}</span>
                </div>
                <h2 className="mt-4 text-xl font-bold">{item.title}</h2>
                <p className="mt-1 text-sm text-[color:var(--muted)]">{item.originalTitle}</p>
                <p className="mt-3 line-clamp-2 text-sm leading-6 text-[color:var(--muted)]">{item.description}</p>
                <div className="mt-5 flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span>整剧进度</span>
                      <span className="font-semibold">{item.progress}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-black/10">
                      <div className="h-2 rounded-full bg-[color:var(--amber)]" style={{ width: `${item.progress}%` }} />
                    </div>
                  </div>
                  <Link href={actionHref} className="ink-action flex h-11 shrink-0 items-center gap-2 rounded-md px-4 text-sm font-semibold">
                    <Play className="h-4 w-4" aria-hidden="true" />
                    {targetEpisode ? (hasProgress ? "继续学" : "从头学") : "暂无片段"}
                  </Link>
                </div>
                <div className="mt-5 border-t border-[color:var(--line)] pt-4">
                  <h3 className="text-sm font-bold">学习片段</h3>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {item.episodes.map((episode) => (
                      <Link
                        key={episode.id}
                        href={`/learn/${episode.id}`}
                        className="group/episode rounded-md border border-[color:var(--line)] bg-white/45 p-3 text-sm transition hover:border-[color:var(--ink)] hover:bg-white"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-semibold group-hover/episode:underline">{episode.title}</p>
                            <p className="mt-1 flex items-center gap-1 text-xs text-[color:var(--muted)]">
                              <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                              {formatTime(episode.durationSeconds)}
                            </p>
                          </div>
                          <Play className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--amber)]" aria-hidden="true" />
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
