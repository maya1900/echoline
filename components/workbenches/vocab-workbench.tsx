"use client";

import { useMemo, useState } from "react";
import { BookMarked, Check, Search } from "lucide-react";
import type { VocabItem } from "@/lib/types";
import { cn } from "@/lib/utils";

const statusLabels = {
  all: "全部",
  new: "新词",
  learning: "学习中",
  mastered: "已掌握"
};

export function VocabWorkbench({ items }: { items: VocabItem[] }) {
  const [localItems, setLocalItems] = useState(items);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<keyof typeof statusLabels>("all");
  const [reviewingId, setReviewingId] = useState("");

  const filtered = useMemo(
    () =>
      localItems.filter((item) => {
        const matchesStatus = status === "all" || item.status === status;
        const matchesQuery = `${item.word} ${item.translation} ${item.contextSentence}`.toLowerCase().includes(query.toLowerCase());
        return matchesStatus && matchesQuery;
      }),
    [localItems, query, status]
  );

  async function reviewItem(item: VocabItem) {
    const nextReviewCount = item.reviewCount + 1;
    const nextStatus = nextReviewCount >= 3 ? "mastered" : "learning";
    const nextDue = new Date();
    nextDue.setDate(nextDue.getDate() + (nextStatus === "mastered" ? 7 : 1));
    setReviewingId(item.id);

    const response = await fetch(`/api/vocab/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: nextStatus,
        reviewCount: nextReviewCount,
        dueAt: nextDue.toISOString()
      })
    }).catch(() => null);

    if (response?.ok) {
      setLocalItems((current) =>
        current.map((entry) =>
          entry.id === item.id
            ? {
                ...entry,
                status: nextStatus,
                reviewCount: nextReviewCount,
                dueAt: nextStatus === "mastered" ? "7 天后" : "明天"
              }
            : entry
        )
      );
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
              {label}
              {status === key ? <Check className="h-4 w-4" aria-hidden="true" /> : null}
            </button>
          ))}
        </div>
      </aside>

      <section className="grid gap-3 md:grid-cols-2">
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
              <span>到期：{item.dueAt}</span>
            </div>
            <button onClick={() => reviewItem(item)} className="ink-action mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-md text-sm font-semibold">
              <BookMarked className="h-4 w-4" aria-hidden="true" />
              {reviewingId === item.id ? "更新中" : "复习"}
            </button>
          </article>
        ))}
      </section>
    </div>
  );
}
