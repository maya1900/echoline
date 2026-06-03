"use client";

import { useState } from "react";
import { Save } from "lucide-react";
import type { StudyPlan } from "@/lib/types";

export function PlanWorkbench({ plan }: { plan: StudyPlan }) {
  const [minutes, setMinutes] = useState(plan.dailyMinutes);
  const [lines, setLines] = useState(plan.dailyLines);
  const [repeats, setRepeats] = useState(plan.dailyRepeats);
  const [saveState, setSaveState] = useState("");

  async function savePlan() {
    setSaveState("保存中");
    const response = await fetch("/api/study-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dailyMinutes: minutes,
        dailyLines: lines,
        dailyRepeats: repeats
      })
    }).catch(() => null);

    setSaveState(response?.ok ? "已保存" : "保存失败");
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      <section className="rounded-md border border-[color:var(--line)] bg-[color:var(--panel)] p-5">
        <h2 className="text-xl font-bold">每日目标</h2>
        <div className="mt-5 grid gap-4">
          <PlanSlider label="学习分钟" value={minutes} min={10} max={90} suffix="分钟" onChange={setMinutes} />
          <PlanSlider label="精听句子" value={lines} min={5} max={60} suffix="句" onChange={setLines} />
          <PlanSlider label="跟读次数" value={repeats} min={2} max={30} suffix="次" onChange={setRepeats} />
        </div>
        <button onClick={savePlan} className="ink-action mt-6 flex h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold">
          <Save className="h-4 w-4" aria-hidden="true" />
          {saveState || "保存计划"}
        </button>
      </section>

      <aside className="rounded-md border border-[color:var(--line)] bg-[color:var(--panel)] p-5">
        <h2 className="text-xl font-bold">今日完成</h2>
        <div className="mt-5 space-y-4">
          <PlanProgress label="分钟" done={plan.completedMinutes} total={minutes} />
          <PlanProgress label="句子" done={plan.completedLines} total={lines} />
          <PlanProgress label="跟读" done={plan.completedRepeats} total={repeats} />
        </div>
      </aside>
    </div>
  );
}

function PlanSlider({
  label,
  value,
  min,
  max,
  suffix,
  onChange
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block rounded-md border border-[color:var(--line)] p-4">
      <span className="mb-3 flex items-center justify-between gap-3 text-sm">
        <span className="font-semibold">{label}</span>
        <span className="sentence-font text-xl font-bold">
          {value}
          <span className="ml-1 text-sm font-normal text-[color:var(--muted)]">{suffix}</span>
        </span>
      </span>
      <input type="range" min={min} max={max} step="1" value={value} onChange={(event) => onChange(Number(event.target.value))} className="w-full accent-[color:var(--green)]" />
    </label>
  );
}

function PlanProgress({ label, done, total }: { label: string; done: number; total: number }) {
  const percent = Math.min((done / total) * 100, 100);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm">
        <span>{label}</span>
        <span className="font-semibold">
          {done}/{total}
        </span>
      </div>
      <div className="h-2 rounded-full bg-black/10">
        <div className="h-2 rounded-full bg-[color:var(--amber)]" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
