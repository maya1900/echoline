"use client";

import { useState } from "react";
import { Bell, Captions, Gauge, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function SettingsWorkbench() {
  const [englishFirst, setEnglishFirst] = useState(true);
  const [autoPause, setAutoPause] = useState(true);
  const [notify, setNotify] = useState(false);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <SettingGroup icon={Captions} title="字幕">
        <SettingToggle label="英文优先显示" active={englishFirst} onClick={() => setEnglishFirst((value) => !value)} />
        <SettingToggle label="逐句结束自动暂停" active={autoPause} onClick={() => setAutoPause((value) => !value)} />
      </SettingGroup>

      <SettingGroup icon={Gauge} title="播放">
        <label className="block rounded-md border border-[color:var(--line)] p-4">
          <span className="mb-3 block text-sm font-semibold">默认速度 0.9x</span>
          <input type="range" min="0.5" max="1.25" step="0.05" defaultValue="0.9" className="w-full accent-[color:var(--green)]" />
        </label>
        <label className="block rounded-md border border-[color:var(--line)] p-4">
          <span className="mb-3 block text-sm font-semibold">单句循环 3 次</span>
          <input type="range" min="1" max="8" step="1" defaultValue="3" className="w-full accent-[color:var(--amber)]" />
        </label>
      </SettingGroup>

      <SettingGroup icon={Settings2} title="AI 评分">
        <div className="rounded-md border border-[color:var(--line)] p-4 text-sm font-semibold">评分服务未接入</div>
        <div className="rounded-md border border-[color:var(--line)] p-4 text-sm leading-6 text-[color:var(--muted)]">接入后只展示转写、准确度、完整度、漏词、总分和中文短反馈。</div>
      </SettingGroup>

      <SettingGroup icon={Bell} title="提醒">
        <SettingToggle label="每日复习提醒" active={notify} onClick={() => setNotify((value) => !value)} />
        <div className="rounded-md border border-[color:var(--line)] p-4 text-sm leading-6 text-[color:var(--muted)]">后续接入账户与通知渠道后启用。</div>
      </SettingGroup>
    </div>
  );
}

function SettingGroup({ icon: Icon, title, children }: { icon: typeof Captions; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-md border border-[color:var(--line)] bg-[color:var(--panel)] p-5">
      <div className="mb-4 flex items-center gap-2">
        <Icon className="h-5 w-5 text-[color:var(--amber)]" aria-hidden="true" />
        <h2 className="text-xl font-bold">{title}</h2>
      </div>
      <div className="grid gap-3">{children}</div>
    </section>
  );
}

function SettingToggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex h-14 items-center justify-between gap-3 rounded-md border border-[color:var(--line)] p-3 text-left text-sm">
      <span className="font-semibold">{label}</span>
      <span className={cn("relative h-7 w-12 rounded-full border border-[color:var(--line)] transition", active ? "bg-[color:var(--green)]" : "bg-white")}>
        <span className={cn("absolute top-1 h-5 w-5 rounded-full bg-white shadow transition", active ? "left-6" : "left-1")} />
      </span>
    </button>
  );
}
