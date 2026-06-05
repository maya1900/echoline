"use client";

import { useMemo, useState } from "react";
import { BookMarked, Check, Eye, RotateCcw, Search, Sparkles } from "lucide-react";
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
  { quality: "again", label: "想不起来", icon: RotateCcw },
  { quality: "good", label: "记住了", icon: Check },
  { quality: "easy", label: "太简单", icon: Sparkles }
] as const;

export function VocabWorkbench({ items }: { items: VocabItem[] }) {
  const [localItems, setLocalItems] = useState(items);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<keyof typeof statusLabels>("due");
  const [reviewingId, setReviewingId] = useState("");
  const [revealedIds, setRevealedIds] = useState<Set<string>>(() => new Set());

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
      setRevealedIds((current) => {
        const next = new Set(current);
        next.delete(item.id);
        return next;
      });
    }

    setReviewingId("");
  }

  function revealItem(itemId: string) {
    setRevealedIds((current) => {
      const next = new Set(current);
      next.add(itemId);
      return next;
    });
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
        <div className="rounded-md border border-[color:var(--ink)] bg-[color:var(--paper)] p-4 md:col-span-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-bold">复习方式：先回忆，再看答案</h2>
              <p className="mt-1 text-sm leading-6 text-[color:var(--muted)]">先根据单词和例句在脑子里说出中文意思，再点“显示答案”。看完答案后按真实记忆结果安排下次复习。</p>
            </div>
            <span className="shrink-0 rounded-md border border-[color:var(--line)] px-3 py-2 text-sm font-semibold text-[color:var(--muted)]">
              到期 {dueCount} 个
            </span>
          </div>
        </div>
        {filtered.length === 0 ? (
          <div className="rounded-md border border-[color:var(--line)] bg-[color:var(--panel)] p-5 md:col-span-2">
            <h2 className="font-bold">这一组没有待复习单词</h2>
            <p className="mt-2 text-sm text-[color:var(--muted)]">换个筛选，或从字幕里继续收藏新词。</p>
          </div>
        ) : null}
        {filtered.map((item) => {
          const isRevealed = revealedIds.has(item.id);

          return (
            <article key={item.id} className="rounded-md border border-[color:var(--line)] bg-[color:var(--panel)] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-2xl font-bold">{item.word}</h2>
                  <p className="mt-1 text-sm text-[color:var(--muted)]">{item.phonetic || "暂无音标"}</p>
                </div>
                <span className="shrink-0 rounded border border-[color:var(--line)] px-2 py-1 text-xs font-semibold text-[color:var(--muted)]">{statusLabels[item.status]}</span>
              </div>

              <div className="mt-4 rounded-md border border-[color:var(--line)] bg-white/55 p-3">
                <p className="text-xs font-semibold uppercase text-[color:var(--muted)]">例句线索</p>
                <p className="sentence-font mt-2 text-base leading-7">{item.contextSentence || "暂无例句"}</p>
              </div>

              {isRevealed ? (
                <div className="mt-3 rounded-md border border-[color:var(--ink)] bg-white p-3">
                  <p className="text-xs font-semibold uppercase text-[color:var(--muted)]">答案</p>
                  <p className="mt-2 text-base font-bold">{item.translation || "暂无释义，可回到学习页重新查词补全。"}</p>
                </div>
              ) : (
                <div className="mt-3 rounded-md border border-dashed border-[color:var(--line)] bg-white/45 p-3">
                  <p className="text-sm font-semibold">先别看答案</p>
                  <p className="mt-1 text-sm leading-6 text-[color:var(--muted)]">试着说出中文释义，或者用自己的话解释它在这句里的意思。</p>
                </div>
              )}

              <div className="mt-4 flex items-center justify-between gap-3 text-sm text-[color:var(--muted)]">
                <span>复习 {item.reviewCount} 次</span>
                <span>{item.isDue ? "今天到期" : `到期：${item.dueAt}`}</span>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 text-xs text-[color:var(--muted)]">
                <span>间隔 {item.intervalDays} 天</span>
                <span>熟练度 {item.ease.toFixed(2)}</span>
              </div>

              {!isRevealed ? (
                <button
                  type="button"
                  onClick={() => revealItem(item.id)}
                  className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-md border border-[color:var(--ink)] text-sm font-bold transition hover:bg-[color:var(--ink)] hover:text-white"
                >
                  <Eye className="h-4 w-4" aria-hidden="true" />
                  显示答案
                </button>
              ) : (
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
              )}

              <div className="mt-3 flex items-center gap-2 text-xs text-[color:var(--muted)]">
                <BookMarked className="h-4 w-4 text-[color:var(--amber)]" aria-hidden="true" />
                <span>{isRevealed ? "按刚才回忆的真实感觉选择，不按答案熟不熟。" : item.isDue ? "完成后自动安排下次复习" : "未到期也可提前复习"}</span>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
