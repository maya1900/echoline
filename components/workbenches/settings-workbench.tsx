"use client";

import { useState } from "react";
import { Bell, Captions, Gauge, Settings2 } from "lucide-react";
import type { UserSettings } from "@/lib/types";
import { cn } from "@/lib/utils";

const asrProviderOptions = ["openai"];

export function SettingsWorkbench({ initialSettings }: { initialSettings: UserSettings }) {
  const [settings, setSettings] = useState(initialSettings);
  const [asrApiKeyInput, setAsrApiKeyInput] = useState("");
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [notify, setNotify] = useState(false);

  async function saveSettings() {
    setIsSaving(true);
    setMessage("保存中");
    const response = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...settings,
        asrApiKey: asrApiKeyInput
      })
    }).catch(() => null);
    const payload = response ? ((await response.json().catch(() => null)) as { data?: UserSettings; error?: string } | null) : null;

    if (response?.ok && payload?.data) {
      setSettings(payload.data);
      setAsrApiKeyInput("");
      setMessage("已保存");
    } else {
      setMessage(payload?.error ?? "保存失败");
    }

    setIsSaving(false);
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <SettingGroup icon={Captions} title="字幕">
        <SettingToggle
          label="英文优先显示"
          active={settings.subtitleLanguage !== "chinese"}
          onClick={() => setSettings((current) => ({ ...current, subtitleLanguage: current.subtitleLanguage === "chinese" ? "both" : "chinese" }))}
        />
        <SettingToggle label="逐句结束自动暂停" active={settings.autoLoop} onClick={() => setSettings((current) => ({ ...current, autoLoop: !current.autoLoop }))} />
      </SettingGroup>

      <SettingGroup icon={Gauge} title="播放">
        <label className="block rounded-md border border-[color:var(--line)] p-4">
          <span className="mb-3 block text-sm font-semibold">默认速度 {settings.defaultPlaybackRate.toFixed(2)}x</span>
          <input
            type="range"
            min="0.5"
            max="1.25"
            step="0.05"
            value={settings.defaultPlaybackRate}
            onChange={(event) => setSettings((current) => ({ ...current, defaultPlaybackRate: Number(event.target.value) }))}
            className="w-full accent-[color:var(--green)]"
          />
        </label>
        <label className="block rounded-md border border-[color:var(--line)] p-4">
          <span className="mb-3 block text-sm font-semibold">单句循环 3 次</span>
          <input type="range" min="1" max="8" step="1" defaultValue="3" className="w-full accent-[color:var(--amber)]" />
        </label>
      </SettingGroup>

      <SettingGroup icon={Settings2} title="AI 评分">
        <SettingToggle label="启用跟读评分" active={settings.aiScoringEnabled} onClick={() => setSettings((current) => ({ ...current, aiScoringEnabled: !current.aiScoringEnabled }))} />
        <div className="rounded-md border border-[color:var(--line)] p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold">{settings.asrApiKeyConfigured ? "转写服务已接入" : "转写服务未接入"}</span>
            <span className="rounded border border-[color:var(--line)] px-2 py-1 text-xs font-semibold text-[color:var(--muted)]">
              {settings.asrProvider}
            </span>
          </div>
          <div className="grid gap-3">
            <ComboField
              label="ASR Provider"
              value={settings.asrProvider}
              options={asrProviderOptions}
              onChange={(value) => setSettings((current) => ({ ...current, asrProvider: value }))}
            />
            <TextField label="转写模型" value={settings.asrModel} onChange={(value) => setSettings((current) => ({ ...current, asrModel: value }))} />
            <SecretField label="OpenAI API Key" value={asrApiKeyInput} configured={settings.asrApiKeyConfigured} onChange={setAsrApiKeyInput} />
          </div>
        </div>
        <div className="rounded-md border border-[color:var(--line)] p-4 text-sm leading-6 text-[color:var(--muted)]">只展示转写、准确度、完整度、漏词、总分和中文短反馈。</div>
        <button onClick={saveSettings} disabled={isSaving} className="ink-action h-11 rounded-md px-4 text-sm font-semibold disabled:cursor-wait disabled:opacity-70">
          {isSaving ? "保存中" : "保存设置"}
        </button>
        {message ? <p className="text-sm font-semibold text-[color:var(--muted)]">{message}</p> : null}
      </SettingGroup>

      <SettingGroup icon={Bell} title="提醒">
        <SettingToggle label="每日复习提醒" active={notify} onClick={() => setNotify((value) => !value)} />
        <div className="rounded-md border border-[color:var(--line)] p-4 text-sm leading-6 text-[color:var(--muted)]">后续接入账户与通知渠道后启用。</div>
      </SettingGroup>
    </div>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid min-w-0 gap-2 text-sm font-semibold">
      {label}
      <input value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-full min-w-0 rounded-md border border-[color:var(--line)] bg-white/70 px-3 outline-none focus:border-[color:var(--ink)]" />
    </label>
  );
}

function ComboField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  const listId = `${label.replace(/\s+/g, "-")}-options`;

  return (
    <label className="grid min-w-0 gap-2 text-sm font-semibold">
      {label}
      <input
        list={listId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full min-w-0 rounded-md border border-[color:var(--line)] bg-white/70 px-3 outline-none focus:border-[color:var(--ink)]"
      />
      <datalist id={listId}>
        {options.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
    </label>
  );
}

function SecretField({ label, value, configured, onChange }: { label: string; value: string; configured: boolean; onChange: (value: string) => void }) {
  return (
    <label className="grid min-w-0 gap-2 text-sm font-semibold">
      <span className="flex flex-wrap items-center gap-2">
        {label}
        <span className="rounded border border-[color:var(--line)] px-2 py-0.5 text-xs font-semibold text-[color:var(--muted)]">
          {configured ? "已配置" : "未配置"}
        </span>
      </span>
      <input
        type="password"
        value={value}
        placeholder={configured ? "填写新 key 后保存会覆盖当前配置" : "填写 OPENAI_API_KEY"}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full min-w-0 rounded-md border border-[color:var(--line)] bg-white/70 px-3 outline-none focus:border-[color:var(--ink)]"
      />
    </label>
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
