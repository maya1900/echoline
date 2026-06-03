"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Filter, Play, Search } from "lucide-react";
import type { Series } from "@/lib/types";

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
        {filtered.map((item) => (
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
                    <span>剧集进度</span>
                    <span className="font-semibold">{item.progress}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-black/10">
                    <div className="h-2 rounded-full bg-[color:var(--amber)]" style={{ width: `${item.progress}%` }} />
                  </div>
                </div>
                <Link href={`/learn/${item.episodes[0].id}`} className="ink-action flex h-11 shrink-0 items-center gap-2 rounded-md px-4 text-sm font-semibold">
                  <Play className="h-4 w-4" aria-hidden="true" />
                  学习
                </Link>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
