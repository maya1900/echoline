"use client";

import { useMemo, useState } from "react";
import { BookMarked, Check, RotateCcw, Search, Sparkles } from "lucide-react";
import type { VocabItem } from "@/lib/types";
import { cn } from "@/lib/utils";

const statusLabels = {
  due: "到期",
  all: "全部",
  new: "新词",
  learning: "学习中",
  mastered: "已掌握"
};

const reviewActions = [
  { quality: "again", label: "再练", icon: RotateCcw },
  { quality: "good", label: "记得", icon: Check },
  { quality: "easy", label: "熟练", icon: Sparkles }
] as const;

export function VocabWorkbench({ items }: { items: VocabItem[] }) {
  const [localItems, setLocalItems] = useState(items);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<keyof typeof statusLabels>("due");
  const [reviewingId, setReviewingId] = useState("");

  const filtered = useMemo(
    () =>
      localItems.filter((item) => {
        const matchesStatus = status === "all" || (status === "due" ? item.isDue : item.status === status);
        const matchesQuery = `${item.word} ${item.translation} ${item.contextSentence}`.toLowerCase().includes(query.toLowerCase());
        return matchesStatus && matchesQuery;
      }),
    [localItems, query, status]
  );
  const dueCount = localItems.filter((item) => item.isDue).length;

  async function reviewItem(item: VocabItem, reviewQuality: (typeof reviewActions)[number]["quality"]) {
    setReviewingId(item.id);

    const response = await fetch(`/api/vocab/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewQuality })
    }).catch(() => null);
    const payload = response ? ((await response.json().catch(() => null)) as { data?: VocabItem } | null) : null;

    if (response?.ok && payload?.data) {
      setLocalItems((current) => current.map((entry) => (entry.id === item.id ? payload.data! : entry)));
    }

    setReviewingId("");
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
      <aside className="rounded-md border border-[color:var(--line)] bg-[color:var(--panel)] p-4">
        <label className="flex h-11 items-center gap-2 rounded-md border border-[color:var(--line)] bg-white/70 px-3">
          <Search className="h-4 w-4 text-[color:var(--muted)]" aria-hidden="true" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索单词" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
        </label>
        <div className="mt-4 grid gap-2">
          {Object.entries(statusLabels).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setStatus(key as keyof typeof statusLabels)}
              className={cn("flex h-10 items-center justify-between rounded-md border border-[color:var(--line)] px-3 text-sm", status === key && "ink-action border-[color:var(--ink)]")}
            >
              <span>{label}</span>
              <span className="flex items-center gap-2">
                {key === "due" ? <span className="text-xs opacity-80">{dueCount}</span> : null}
                {status === key ? <Check className="h-4 w-4" aria-hidden="true" /> : null}
              </span>
            </button>
          ))}
        </div>
      </aside>

      <section className="grid gap-3 md:grid-cols-2">
        {filtered.length === 0 ? (
          <div className="rounded-md border border-[color:var(--line)] bg-[color:var(--panel)] p-5 md:col-span-2">
            <h2 className="font-bold">这一组没有待复习单词</h2>
            <p className="mt-2 text-sm text-[color:var(--muted)]">换个筛选，或从字幕里继续收藏新词。</p>
          </div>
        ) : null}
        {filtered.map((item) => (
          <article key={item.id} className="rounded-md border border-[color:var(--line)] bg-[color:var(--panel)] p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-2xl font-bold">{item.word}</h2>
                <p className="mt-1 text-sm text-[color:var(--muted)]">{item.phonetic}</p>
              </div>
              <span className="shrink-0 rounded border border-[color:var(--line)] px-2 py-1 text-xs font-semibold text-[color:var(--muted)]">{statusLabels[item.status]}</span>
            </div>
            <p className="mt-4 text-sm font-semibold">{item.translation}</p>
            <p className="sentence-font mt-3 text-base leading-7">{item.contextSentence}</p>
            <div className="mt-4 flex items-center justify-between gap-3 text-sm text-[color:var(--muted)]">
              <span>复习 {item.reviewCount} 次</span>
              <span>{item.isDue ? "今天到期" : `到期：${item.dueAt}`}</span>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 text-xs text-[color:var(--muted)]">
              <span>间隔 {item.intervalDays} 天</span>
              <span>熟练度 {item.ease.toFixed(2)}</span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {reviewActions.map(({ quality, label, icon: Icon }) => (
                <button
                  key={quality}
                  onClick={() => reviewItem(item, quality)}
                  disabled={reviewingId === item.id}
                  className={cn(
                    "flex h-10 items-center justify-center gap-2 rounded-md border border-[color:var(--line)] text-sm font-semibold disabled:opacity-60",
                    quality === "good" && "ink-action border-[color:var(--ink)]"
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {reviewingId === item.id ? "更新" : label}
                </button>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs text-[color:var(--muted)]">
              <BookMarked className="h-4 w-4 text-[color:var(--amber)]" aria-hidden="true" />
              <span>{item.isDue ? "完成后自动安排下次复习" : "未到期也可提前复习"}</span>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
